import AppIntents
import Foundation

@available(iOS 16.0, *)
struct ShoppingProduct: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Producto"
    static var defaultQuery = ShoppingProductQuery()
    let id: String
    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(id)") }
}

@available(iOS 16.0, *)
struct ShoppingProductQuery: EntityStringQuery {
    func entities(for identifiers: [String]) async throws -> [ShoppingProduct] {
        identifiers.filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && $0.count <= 500 }.map { ShoppingProduct(id: $0) }
    }
    func entities(matching string: String) async throws -> [ShoppingProduct] {
        try await entities(for: [string.trimmingCharacters(in: .whitespacesAndNewlines)])
    }
    func suggestedEntities() async throws -> [ShoppingProduct] {
        try await SiriShoppingStore.commonProducts().map { ShoppingProduct(id: $0) }
    }
}

@available(iOS 16.0, *)
struct ShoppingListEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Lista"
    static var defaultQuery = ShoppingListQuery()
    let id: String
    let name: String
    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }
    init(_ record: SiriListRecord) { id = record.id; name = record.name }
}

@available(iOS 16.0, *)
struct ShoppingListQuery: EntityStringQuery {
    func entities(for identifiers: [String]) async throws -> [ShoppingListEntity] {
        try await SiriShoppingStore.lists().filter { identifiers.contains($0.id) }.map(ShoppingListEntity.init)
    }
    func entities(matching string: String) async throws -> [ShoppingListEntity] {
        try await SiriShoppingStore.lists().filter { $0.name.localizedStandardContains(string) }.map(ShoppingListEntity.init)
    }
    func suggestedEntities() async throws -> [ShoppingListEntity] {
        try await SiriShoppingStore.lists().map(ShoppingListEntity.init)
    }
}

@available(iOS 16.0, *)
struct AddShoppingProduct: AppIntent {
    static var title: LocalizedStringResource = "Añadir producto"
    static var description = IntentDescription("Añade productos a tus listas de Qué te falta y pregunta antes de aumentar un producto repetido. Requiere iniciar sesión en la app y conexión a Internet.")
    static var openAppWhenRun = false
    static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed

    @Parameter(title: "Producto", requestValueDialog: "¿Qué quieres añadir?")
    var product: ShoppingProduct

    @Parameter(title: "Lista")
    var list: ShoppingListEntity?

    static var parameterSummary: some ParameterSummary {
        Summary("Añadir \(\.$product) a \(\.$list)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let initialUid = try await SiriShoppingStore.readyUser().uid
        let lists = try await SiriShoppingStore.lists()
        guard !lists.isEmpty else { throw SiriShoppingError(message: "Abre Qué te falta y crea o acepta una lista antes de añadir productos con Siri.") }
        let target: ShoppingListEntity
        if let list {
            guard lists.contains(where: { $0.id == list.id }) else { throw SiriShoppingError(message: "Ya no tienes acceso a esa lista. Elige otra en Qué te falta.") }
            target = list
        } else if let preferred = try SiriShoppingStore.preferredList(in: lists) {
            target = ShoppingListEntity(preferred)
        } else {
            target = try await $list.requestDisambiguation(among: lists.map(ShoppingListEntity.init), dialog: "¿En qué lista lo añadimos?")
        }
        let requestId = UUID().uuidString
        var approved: [String] = []
        var conflicts = 0
        // Re-read after each spoken confirmation: a family member may have
        // changed the quantity or removed access while Siri was listening.
        while conflicts < 4 && approved.count < 40 {
            guard try SiriShoppingStore.user().uid == initialUid else { throw SiriShoppingError(message: "La sesión ha cambiado. Vuelve a pedir el producto.") }
            let snapshot = try await SiriShoppingStore.read(listId: target.id)
            let plan = try SiriShoppingStore.plan(snapshot: snapshot, text: product.id, approved: approved, requestId: requestId)
            if let duplicate = plan.duplicates.first {
                let confirmed = try await $product.requestConfirmation(for: product, dialog: IntentDialog(stringLiteral: duplicate.prompt))
                guard confirmed else { return .result(dialog: "De acuerdo, no he cambiado la lista.") }
                approved.append(duplicate.fingerprint)
                continue
            }
            if plan.alreadyApplied {
                return .result(dialog: "El producto ya está guardado en \(target.name).")
            }
            if try await SiriShoppingStore.commit(plan, snapshot: snapshot, listId: target.id, requestId: requestId) {
                return .result(dialog: "He añadido \(plan.summary) a \(target.name).")
            }
            conflicts += 1
        }
        throw SiriShoppingError(message: "La lista está cambiando en otro dispositivo. Inténtalo de nuevo en unos segundos.")
    }
}

@available(iOS 16.0, *)
struct ShoppingShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: AddShoppingProduct(), phrases: [
            "Añade \(\.$product) en \(.applicationName)",
            "Agrega \(\.$product) en \(.applicationName)",
            "Apunta \(\.$product) en \(.applicationName)",
            "Añade un producto en \(.applicationName)",
            "Añade a la lista de \(.applicationName)"
        ], shortTitle: "Añadir producto", systemImageName: "cart.badge.plus")
    }
}
