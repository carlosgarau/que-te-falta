// PROTOTYPE ONLY — intentionally excluded from project.pbxproj and the app.
// Activating this extension requires the signing and session work in README.md.
import AppIntents
import SwiftUI
import WidgetKit

@available(iOS 17.0, *)
struct FamilyListOption: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Lista familiar"
    static var defaultQuery = FamilyListOptionsQuery()
    let id: String
    let name: String
    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }
}

@available(iOS 17.0, *)
struct FamilyListOptionsQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [FamilyListOption] {
        try await WidgetListStore.familyLists()
            .filter { identifiers.contains($0.id) }
            .map { FamilyListOption(id: $0.id, name: $0.name) }
    }

    func suggestedEntities() async throws -> [FamilyListOption] {
        try await WidgetListStore.familyLists().map { FamilyListOption(id: $0.id, name: $0.name) }
    }
}

@available(iOS 17.0, *)
struct FamilyListWidgetConfiguration: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Elegir lista familiar"
    static var description = IntentDescription("Muestra los productos pendientes de una lista familiar a la que tienes acceso.")
    @Parameter(title: "Lista") var list: FamilyListOption?
}

@available(iOS 17.0, *)
struct SetWidgetProductChecked: AppIntent {
    static var title: LocalizedStringResource = "Marcar producto"
    static var description = IntentDescription("Marca o desmarca un producto de la lista familiar seleccionada.")
    static var openAppWhenRun = false
    static var authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication

    @Parameter(title: "Lista") var listID: String
    @Parameter(title: "Producto") var productID: String
    @Parameter(title: "Cuenta") var expectedUserID: String
    @Parameter(title: "Marcado") var checked: Bool

    init() {}
    init(listID: String, productID: String, expectedUserID: String, checked: Bool) {
        self.listID = listID
        self.productID = productID
        self.expectedUserID = expectedUserID
        self.checked = checked
    }

    func perform() async throws -> some IntentResult {
        try await WidgetListStore.setChecked(listID: listID, productID: productID,
                                              expectedUserID: expectedUserID, checked: checked)
        return .result()
    }
}

@available(iOS 17.0, *)
struct FamilyListWidgetEntry: TimelineEntry {
    enum Content {
        case selectList, ready(WidgetListSnapshot), signIn, noAccess, offline, setup
    }
    let date: Date
    let content: Content
}

@available(iOS 17.0, *)
struct FamilyListWidgetProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> FamilyListWidgetEntry {
        FamilyListWidgetEntry(date: .now, content: .selectList)
    }

    func snapshot(for configuration: FamilyListWidgetConfiguration,
                  in context: Context) async -> FamilyListWidgetEntry {
        await entry(for: configuration)
    }

    func timeline(for configuration: FamilyListWidgetConfiguration,
                  in context: Context) async -> Timeline<FamilyListWidgetEntry> {
        let entry = await entry(for: configuration)
        // WidgetKit decides the actual refresh time; this is a request, not a
        // real-time subscription. Interactions trigger their own reload.
        return Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(5 * 60)))
    }

    private func entry(for configuration: FamilyListWidgetConfiguration) async -> FamilyListWidgetEntry {
        guard let selected = configuration.list else {
            return FamilyListWidgetEntry(date: .now, content: .selectList)
        }
        do {
            let snapshot = try await WidgetListStore.snapshot(listID: selected.id)
            return FamilyListWidgetEntry(date: .now, content: .ready(snapshot))
        } catch let error as WidgetListError {
            let content: FamilyListWidgetEntry.Content
            switch error {
            case .configuration: content = .setup
            case .signIn, .accountChanged: content = .signIn
            case .noAccess, .invalidList: content = .noAccess
            case .unavailable, .conflict: content = .offline
            }
            return FamilyListWidgetEntry(date: .now, content: content)
        } catch {
            return FamilyListWidgetEntry(date: .now, content: .offline)
        }
    }
}

@available(iOS 17.0, *)
private enum WidgetPalette {
    static let paper = Color(red: 247/255, green: 244/255, blue: 236/255)
    static let ink = Color(red: 29/255, green: 42/255, blue: 36/255)
    static let muted = Color(red: 110/255, green: 118/255, blue: 111/255)
    static let green = Color(red: 40/255, green: 95/255, blue: 67/255)
}

@available(iOS 17.0, *)
struct FamilyListWidgetView: View {
    let entry: FamilyListWidgetEntry
    @Environment(\.widgetFamily) private var family

    private var rowLimit: Int { family == .systemLarge ? 7 : 4 }

    // Keep one recently checked item visible, so an accidental mark can be
    // undone directly from the widget rather than opening the app.
    private func visibleProducts(_ products: [WidgetProduct]) -> [WidgetProduct] {
        let pending = products.filter { !$0.checked }
        let checked = products.filter(\.checked).reversed()
        if pending.isEmpty { return Array(checked.prefix(rowLimit)) }
        let undo = checked.first.map { [$0] } ?? []
        return Array(pending.prefix(rowLimit - undo.count)) + undo
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            switch entry.content {
            case .ready(let snapshot):
                HStack(alignment: .firstTextBaseline) {
                    Text(snapshot.name)
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .lineLimit(1)
                        .privacySensitive()
                    Spacer(minLength: 8)
                    Text("\(snapshot.pendingCount) pendientes")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(WidgetPalette.muted)
                }
                if snapshot.products.isEmpty {
                    Spacer()
                    Text("Todavía no hay productos")
                        .font(.system(size: 14))
                        .foregroundStyle(WidgetPalette.muted)
                    Spacer()
                } else {
                    ForEach(visibleProducts(snapshot.products)) { product in
                        Button(intent: SetWidgetProductChecked(listID: snapshot.listID,
                                                               productID: product.id,
                                                               expectedUserID: snapshot.userID,
                                                               checked: !product.checked)) {
                            HStack(spacing: 10) {
                                Image(systemName: product.checked ? "checkmark.circle.fill" : "circle")
                                    .font(.system(size: 20))
                                    .foregroundStyle(WidgetPalette.green)
                                Text(product.name)
                                    .font(.system(size: 13, weight: product.checked ? .regular : .semibold))
                                    .lineLimit(1)
                                    .foregroundStyle(WidgetPalette.ink)
                                    .privacySensitive()
                                Spacer(minLength: 0)
                            }
                            .frame(minHeight: 30)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(product.checked ? "Desmarcar" : "Marcar") \(product.name)")
                    }
                    Spacer(minLength: 0)
                    if snapshot.pendingCount == 0 {
                        Text("Todo marcado · toca un producto para deshacer")
                            .font(.system(size: 10))
                            .foregroundStyle(WidgetPalette.muted)
                    }
                }
            case .selectList:
                message("Elige tu lista", detail: "Configura este widget para ver sus pendientes.")
            case .signIn:
                message("Inicia sesión", detail: "Abre Qué te falta para conectar tu cuenta.")
            case .noAccess:
                message("Sin acceso", detail: "Ya no puedes consultar esta lista.")
            case .offline:
                message("Sin conexión", detail: "No se muestran datos antiguos. Reintentaremos después.")
            case .setup:
                message("No disponible", detail: "Falta configurar la sesión compartida del widget.")
            }
        }
        .foregroundStyle(WidgetPalette.ink)
        .padding(14)
        .containerBackground(WidgetPalette.paper, for: .widget)
    }

    private func message(_ title: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("¿Qué te falta?")
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundStyle(WidgetPalette.green)
            Spacer(minLength: 0)
            Text(title).font(.system(size: 19, weight: .semibold, design: .serif))
            Text(detail).font(.system(size: 12)).foregroundStyle(WidgetPalette.muted)
            Spacer(minLength: 0)
        }
    }
}

@available(iOS 17.0, *)
struct FamilyListWidget: Widget {
    let kind = "QueTeFaltaFamilyList"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: FamilyListWidgetConfiguration.self,
                               provider: FamilyListWidgetProvider()) { entry in
            FamilyListWidgetView(entry: entry)
        }
        .configurationDisplayName("Pendientes de la familia")
        .description("Consulta y marca productos de una lista familiar.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

// Deliberately no @main WidgetBundle and no Xcode target membership here.
// Adding one now would expose a non-functional control to real customers.
