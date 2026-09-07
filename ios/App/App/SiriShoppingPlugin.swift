import Capacitor
import AppIntents

@objc(SiriShoppingPlugin)
public class SiriShoppingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SiriShoppingPlugin"
    public let jsName = "SiriShopping"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "setPrimaryList", returnType: CAPPluginReturnPromise)]
    private var changedObserver: NSObjectProtocol?

    public override func load() {
        changedObserver = NotificationCenter.default.addObserver(forName: Notification.Name("SiriShoppingChanged"), object: nil, queue: .main) { [weak self] _ in
            self?.notifyListeners("listChanged", data: [:])
        }
    }

    deinit { if let changedObserver { NotificationCenter.default.removeObserver(changedObserver) } }

    @objc func setPrimaryList(_ call: CAPPluginCall) {
        Task { @MainActor in
            SiriShoppingStore.setPrimaryList(uid: call.getString("uid") ?? "", listId: call.getString("listId") ?? "")
            if #available(iOS 16.0, *) { ShoppingShortcuts.updateAppShortcutParameters() }
            call.resolve()
        }
    }
}

class ShoppingBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(SiriShoppingPlugin())
    }
}
