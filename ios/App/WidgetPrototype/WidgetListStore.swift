// PROTOTYPE ONLY — not a member of any Xcode target until App Groups, shared
// FirebaseAuth Keychain migration, and separate extension signing are verified.
import Foundation
import FirebaseAuth
import FirebaseCore

enum WidgetListError: LocalizedError {
    case configuration, signIn, accountChanged, noAccess, unavailable, invalidList, conflict

    var errorDescription: String? {
        switch self {
        case .configuration: return "El widget todavía no está configurado para compartir la sesión."
        case .signIn: return "Abre Qué te falta e inicia sesión."
        case .accountChanged: return "La cuenta ha cambiado. Vuelve a configurar el widget."
        case .noAccess: return "Ya no tienes acceso a esta lista."
        case .unavailable: return "No se puede conectar con la lista. Inténtalo más tarde."
        case .invalidList: return "La lista o el producto ya no están disponibles."
        case .conflict: return "La lista cambió en otro dispositivo. Inténtalo de nuevo."
        }
    }
}

struct WidgetFamilyList: Identifiable, Sendable {
    let id: String
    let name: String
}

struct WidgetProduct: Identifiable, Sendable {
    let id: String
    let name: String
    let checked: Bool
}

struct WidgetListSnapshot: Sendable {
    let userID: String
    let listID: String
    let name: String
    let products: [WidgetProduct]
    let fetchedAt: Date
    var pendingCount: Int { products.filter { !$0.checked }.count }
}

// No ID token, refresh token, product, or name is persisted in UserDefaults.
// FirebaseAuth owns its encrypted shared-Keychain session. Every fetch and
// write checks the current UID and Firebase membership, then relies on RTDB
// rules as the final permission boundary.
@MainActor
enum WidgetListStore {
    static let appGroupID = "group.com.carlosgarau.lacompra" // Must be registered in Apple Developer.
    private static var selectedAccessGroup = false

    private static func validID(_ id: String) -> Bool {
        !id.isEmpty && id.count <= 128 && id.utf8.allSatisfy {
            (48...57).contains($0) || (65...90).contains($0) ||
            (97...122).contains($0) || $0 == 45 || $0 == 95
        }
    }

    private static func encodedUserID(_ id: String) throws -> String {
        guard !id.isEmpty, id.count <= 256,
              let encoded = id.addingPercentEncoding(withAllowedCharacters:
                .alphanumerics.union(CharacterSet(charactersIn: "-_"))) else {
            throw WidgetListError.accountChanged
        }
        return encoded
    }

    private static func user() async throws -> User {
        // Fail closed: a placeholder entitlement or an unregistered group is
        // not sufficient authorization to access another process's session.
        guard FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupID) != nil else {
            throw WidgetListError.configuration
        }
        if FirebaseApp.app() == nil {
            guard let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
                  let options = FirebaseOptions(contentsOfFile: path) else {
                throw WidgetListError.configuration
            }
            FirebaseApp.configure(options: options)
        }
        let auth = Auth.auth()
        if !selectedAccessGroup {
            do { try auth.useUserAccessGroup(appGroupID) }
            catch { throw WidgetListError.configuration }
            selectedAccessGroup = true
        }
        // Firebase may restore Keychain asynchronously after a cold launch.
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            var handle: AuthStateDidChangeListenerHandle?
            var resumed = false
            handle = auth.addStateDidChangeListener { auth, _ in
                guard !resumed else { return }
                resumed = true
                if let handle { auth.removeStateDidChangeListener(handle) }
                continuation.resume()
            }
            if resumed, let handle { auth.removeStateDidChangeListener(handle) }
        }
        guard let current = auth.currentUser else { throw WidgetListError.signIn }
        return current
    }

    private static func database(_ path: String, user: User, method: String = "GET",
                                 body: Data? = nil, etag: String? = nil) async throws -> (Data, HTTPURLResponse) {
        guard Auth.auth().currentUser?.uid == user.uid else { throw WidgetListError.accountChanged }
        guard let base = FirebaseApp.app()?.options.databaseURL,
              var url = URLComponents(string: base), url.scheme == "https" else {
            throw WidgetListError.configuration
        }
        let token = try await user.getIDToken()
        guard Auth.auth().currentUser?.uid == user.uid else { throw WidgetListError.accountChanged }
        url.percentEncodedPath = "/\(path).json"
        url.queryItems = [URLQueryItem(name: "auth", value: token)]
        guard let endpoint = url.url else { throw WidgetListError.configuration }
        var request = URLRequest(url: endpoint, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        request.httpMethod = method
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if method == "GET", etag == "request" { request.setValue("true", forHTTPHeaderField: "X-Firebase-ETag") }
        if method == "PUT", let etag { request.setValue(etag, forHTTPHeaderField: "if-match") }
        let result: (Data, URLResponse)
        do { result = try await URLSession(configuration: .ephemeral).data(for: request) }
        catch { throw WidgetListError.unavailable } // Never retry an ambiguous write.
        guard let response = result.1 as? HTTPURLResponse else { throw WidgetListError.unavailable }
        if response.statusCode == 401 || response.statusCode == 403 { throw WidgetListError.noAccess }
        if response.statusCode == 412 { return (result.0, response) }
        guard (200..<300).contains(response.statusCode) else { throw WidgetListError.unavailable }
        return (result.0, response)
    }

    private static func object(_ data: Data) throws -> [String: Any] {
        guard let value = try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]) as? [String: Any] else {
            return [:]
        }
        return value
    }

    private static func membership(listID: String, user: User) async throws -> [String: Any] {
        guard validID(listID) else { throw WidgetListError.invalidList }
        let (data, _) = try await database("userLists/\(encodedUserID(user.uid))/\(listID)", user: user)
        let record = try object(data)
        guard record["type"] as? String == "family",
              ["owner", "editor"].contains(record["role"] as? String ?? "") else {
            throw WidgetListError.noAccess
        }
        return record
    }

    static func familyLists() async throws -> [WidgetFamilyList] {
        let account = try await user()
        let (data, _) = try await database("userLists/\(encodedUserID(account.uid))", user: account)
        let records = try object(data)
        return records.compactMap { id, raw -> WidgetFamilyList? in
            guard validID(id), let record = raw as? [String: Any],
                  record["type"] as? String == "family",
                  ["owner", "editor"].contains(record["role"] as? String ?? "") else { return nil }
            return WidgetFamilyList(id: id, name: record["name"] as? String ?? "Lista familiar")
        }.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }

    private static func state(listID: String, user: User) async throws -> ([String: Any], String) {
        let (data, response) = try await database("lists/\(listID)/state", user: user, etag: "request")
        guard let etag = response.value(forHTTPHeaderField: "ETag"), !etag.isEmpty else {
            throw WidgetListError.unavailable
        }
        return (try object(data), etag)
    }

    static func snapshot(listID: String) async throws -> WidgetListSnapshot {
        let account = try await user()
        let record = try await membership(listID: listID, user: account)
        let (data, _) = try await state(listID: listID, user: account)
        guard Auth.auth().currentUser?.uid == account.uid else { throw WidgetListError.accountChanged }
        let rows = data["items"] as? [[String: Any]] ?? []
        let products = rows.compactMap { row -> WidgetProduct? in
            guard let id = row["id"] as? String, validID(id),
                  let name = row["name"] as? String, !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                return nil
            }
            return WidgetProduct(id: id, name: name, checked: row["checked"] as? Bool == true)
        }
        return WidgetListSnapshot(userID: account.uid, listID: listID,
                                  name: record["name"] as? String ?? "Lista familiar",
                                  products: products, fetchedAt: Date())
    }

    static func setChecked(listID: String, productID: String, expectedUserID: String,
                           checked: Bool) async throws {
        guard validID(listID), validID(productID), !expectedUserID.isEmpty else { throw WidgetListError.invalidList }
        let account = try await user()
        guard account.uid == expectedUserID else { throw WidgetListError.accountChanged }
        _ = try await membership(listID: listID, user: account)
        // The desired value is explicit, not a blind inversion. Retry only a
        // definite 412; on timeout the commit may have succeeded, so stop.
        for _ in 0..<4 {
            let (original, etag) = try await state(listID: listID, user: account)
            var updated = original
            guard var rows = updated["items"] as? [[String: Any]],
                  let index = rows.firstIndex(where: { $0["id"] as? String == productID }) else {
                throw WidgetListError.invalidList
            }
            if rows[index]["checked"] as? Bool == checked { return }
            rows[index]["checked"] = checked
            rows[index]["updatedAt"] = ISO8601DateFormatter().string(from: Date())
            updated["items"] = rows // Preserve all other state fields.
            let body = try JSONSerialization.data(withJSONObject: updated)
            guard Auth.auth().currentUser?.uid == expectedUserID else { throw WidgetListError.accountChanged }
            let (_, response) = try await database("lists/\(listID)/state", user: account,
                                                   method: "PUT", body: body, etag: etag)
            if response.statusCode == 412 { continue }
            return // WidgetKit reloads the timeline after the intent returns.
        }
        throw WidgetListError.conflict
    }
}
