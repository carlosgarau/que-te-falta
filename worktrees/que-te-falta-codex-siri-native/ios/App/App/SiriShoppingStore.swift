import Foundation
import FirebaseAuth
import FirebaseCore
import JavaScriptCore

struct SiriShoppingError: LocalizedError {
    let message: String
    let status: Int?
    init(message: String, status: Int? = nil) { self.message = message; self.status = status }
    var errorDescription: String? { message }
}

struct SiriListRecord: Sendable {
    let id: String
    let name: String
    let type: String
}

struct SiriSnapshot {
    let uid: String
    let state: [String: Any]
    let etag: String
}

struct SiriDuplicate {
    let fingerprint: String
    let prompt: String
}

struct SiriPlan {
    let state: [String: Any]
    let duplicates: [SiriDuplicate]
    let summary: String
    let alreadyApplied: Bool
}

// App Intents run in the application process. FirebaseAuth therefore uses the
// same keychain session as the Capacitor login, including on a cold launch.
@MainActor
enum SiriShoppingStore {
    static let selectedListKey = "siri-shopping-primary-list"
    static let selectedUserKey = "siri-shopping-user"
    static let changedNotification = Notification.Name("SiriShoppingChanged")

    static func readyUser() async throws -> User {
        if FirebaseApp.app() == nil { FirebaseApp.configure() }
        // On a cold Siri launch currentUser can be nil while Keychain restores.
        // Firebase's first auth callback signals that initialization is complete.
        let auth = Auth.auth()
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            var handle: AuthStateDidChangeListenerHandle?
            var resumed = false
            handle = auth.addStateDidChangeListener { auth, _ in
                guard !resumed else { return }
                resumed = true
                if let handle { auth.removeStateDidChangeListener(handle) }
                continuation.resume()
            }
        }
        try Task.checkCancellation()
        return try user()
    }

    static func user() throws -> User {
        if FirebaseApp.app() == nil { FirebaseApp.configure() }
        guard let user = Auth.auth().currentUser else {
            throw SiriShoppingError(message: "Abre Qué te falta e inicia sesión para usar tus listas con Siri.")
        }
        return user
    }

    static func setPrimaryList(uid: String, listId: String) {
        // No products, credentials or tokens are copied into UserDefaults.
        UserDefaults.standard.set(uid, forKey: selectedUserKey)
        UserDefaults.standard.set(listId, forKey: selectedListKey)
    }

    static func lists() async throws -> [SiriListRecord] {
        let uid = try await readyUser().uid
        let (data, _) = try await request(path: "userLists/\(uid)")
        let records = try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]) as? [String: [String: Any]] ?? [:]
        return records.compactMap { id, value in
            guard ["owner", "editor"].contains(value["role"] as? String ?? "") else { return nil }
            return SiriListRecord(id: id, name: value["name"] as? String ?? "Lista", type: value["type"] as? String ?? "family")
        }.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }

    static func preferredList(in lists: [SiriListRecord]) throws -> SiriListRecord? {
        let uid = try user().uid
        if UserDefaults.standard.string(forKey: selectedUserKey) == uid,
           let id = UserDefaults.standard.string(forKey: selectedListKey),
           let preferred = lists.first(where: { $0.id == id }) { return preferred }
        let family = lists.filter { $0.type == "family" }
        return family.count == 1 ? family.first : (lists.count == 1 ? lists.first : nil)
    }

    static func read(listId: String) async throws -> SiriSnapshot {
        let uid = try user().uid
        let (data, response) = try await request(path: "lists/\(listId)/state", headers: ["X-Firebase-ETag": "true"])
        guard let etag = response.value(forHTTPHeaderField: "ETag") else {
            throw SiriShoppingError(message: "No he podido comprobar la versión de la lista. Inténtalo de nuevo.")
        }
        let object = try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])
        return SiriSnapshot(uid: uid, state: object as? [String: Any] ?? [:], etag: etag)
    }

    static func plan(snapshot: SiriSnapshot, text: String, approved: [String], requestId: String) throws -> SiriPlan {
        let context = try coreContext()
        guard let value = context.objectForKeyedSubscript("SiriShopping")?.objectForKeyedSubscript("planSiriAddition")?
            .call(withArguments: [snapshot.state, text, approved, requestId, Date().timeIntervalSince1970 * 1000]),
              context.exception == nil,
              let result = value.toDictionary() as? [String: Any],
              let state = result["state"] as? [String: Any] else {
            throw SiriShoppingError(message: context.exception?.toString() ?? "No he entendido el producto. Dímelo otra vez.")
        }
        let duplicates = (result["duplicates"] as? [[String: String]] ?? []).compactMap { value -> SiriDuplicate? in
            guard let fingerprint = value["fingerprint"], let prompt = value["prompt"] else { return nil }
            return SiriDuplicate(fingerprint: fingerprint, prompt: prompt)
        }
        return SiriPlan(state: state, duplicates: duplicates, summary: result["summary"] as? String ?? "", alreadyApplied: result["alreadyApplied"] as? Bool ?? false)
    }

    static func commonProducts() throws -> [String] {
        let context = try coreContext()
        return context.objectForKeyedSubscript("SiriShopping")?.objectForKeyedSubscript("siriProducts")?.call(withArguments: [])?.toArray() as? [String] ?? []
    }

    static func coreContext() throws -> JSContext {
        guard let url = Bundle.main.url(forResource: "siri-core", withExtension: "js", subdirectory: "public"),
              let context = JSContext() else {
            throw SiriShoppingError(message: "No se ha podido preparar Siri. Abre Qué te falta y comprueba la actualización.")
        }
        context.evaluateScript(try String(contentsOf: url, encoding: .utf8))
        guard context.exception == nil else { throw SiriShoppingError(message: "No se ha podido preparar la lista para Siri.") }
        return context
    }

    // A definite ETag conflict may be retried. An ambiguous network failure must
    // be reconciled against the receipt, never blindly replayed as another add.
    static func commit(_ plan: SiriPlan, snapshot: SiriSnapshot, listId: String, requestId: String) async throws -> Bool {
        guard try user().uid == snapshot.uid else { throw SiriShoppingError(message: "La sesión ha cambiado. Vuelve a pedir el producto.") }
        let body = try JSONSerialization.data(withJSONObject: plan.state)
        do {
            let (_, response) = try await request(path: "lists/\(listId)/state", method: "PUT", body: body, headers: ["if-match": snapshot.etag], allowConflict: true, expectedUid: snapshot.uid)
            if response.statusCode == 412 { return false }
        } catch {
            if let status = (error as? SiriShoppingError)?.status, [401, 403, 400].contains(status) { throw error }
            if let latest = try? await read(listId: listId),
               let items = latest.state["items"] as? [[String: Any]],
               items.contains(where: { ($0["siriRequestIds"] as? [String] ?? []).contains(requestId) }) {
                NotificationCenter.default.post(name: changedNotification, object: nil)
                return true
            }
            throw SiriShoppingError(message: "No he podido confirmar si se guardó. Revisa la lista en Qué te falta antes de repetirlo.")
        }
        NotificationCenter.default.post(name: changedNotification, object: nil)
        return true
    }

    private static func request(path: String, method: String = "GET", body: Data? = nil, headers: [String: String] = [:], allowConflict: Bool = false, expectedUid: String? = nil) async throws -> (Data, HTTPURLResponse) {
        let account = try user()
        let token = try await account.getIDToken()
        guard Auth.auth().currentUser?.uid == account.uid, expectedUid == nil || expectedUid == account.uid else {
            throw SiriShoppingError(message: "La sesión ha cambiado. Abre Qué te falta para continuar.")
        }
        guard let database = FirebaseApp.app()?.options.databaseURL,
              var components = URLComponents(string: database) else {
            throw SiriShoppingError(message: "No se ha podido conectar con tus listas.")
        }
        components.path = "/\(path).json"
        components.queryItems = [URLQueryItem(name: "auth", value: token)]
        guard let url = components.url else { throw SiriShoppingError(message: "La lista no es válida.") }
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        request.httpMethod = method
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        for (key, value) in headers { request.setValue(value, forHTTPHeaderField: key) }
        let data: Data
        let response: URLResponse
        do { (data, response) = try await URLSession.shared.data(for: request) }
        catch { throw SiriShoppingError(message: "No puedo conectar con tu lista. Comprueba la conexión a Internet.") }
        guard let http = response as? HTTPURLResponse else { throw SiriShoppingError(message: "No he recibido respuesta de tu lista.") }
        if allowConflict && http.statusCode == 412 { return (data, http) }
        guard (200..<300).contains(http.statusCode) else {
            throw SiriShoppingError(message: [401, 403].contains(http.statusCode)
                ? "Ya no tienes acceso a esa lista o debes iniciar sesión de nuevo en Qué te falta."
                : "No he podido guardar el producto en tu lista. Inténtalo más tarde.", status: http.statusCode)
        }
        return (data, http)
    }
}
