// Host-app bridge for the widget. Keep this branch undistributed until
// device-level auth migration and logout privacy have been verified.
import Capacitor
import FirebaseAuth
import FirebaseCore
import Foundation
import UIKit
import WidgetKit

@MainActor
private enum WidgetSessionCoordinator {
    private static let appGroup = "group.com.carlosgarau.lacompra"
    private static let keychainGroup = "N44AYP9B99.\(appGroup)"
    private static var preparation: Task<Void, Error>?

    static func prepare() async throws {
        if let preparation { return try await preparation.value }
        let task = Task<Void, Error> { try await migrateIfNeeded() }
        preparation = task
        do { try await task.value }
        catch {
            preparation = nil // A missing entitlement can be fixed by a new build.
            throw error
        }
    }

    private static func migrateIfNeeded() async throws {
        guard FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) != nil else {
            throw NSError(domain: "WidgetSession", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "Falta la capacidad App Groups."])
        }
        if FirebaseApp.app() == nil { FirebaseApp.configure() }
        let auth = Auth.auth()
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            var listener: AuthStateDidChangeListenerHandle?
            var resumed = false
            listener = auth.addStateDidChangeListener { _, _ in
                guard !resumed else { return }
                resumed = true
                if let listener { auth.removeStateDidChangeListener(listener) }
                continuation.resume()
            }
            if resumed, let listener { auth.removeStateDidChangeListener(listener) }
        }
        let privateUser = auth.currentUser
        let sharedUser = try auth.getStoredUser(forAccessGroup: keychainGroup)
        try auth.useUserAccessGroup(keychainGroup)
        if let privateUser, privateUser.uid != sharedUser?.uid {
            // Firebase's switch to a shared group momentarily emits a nil
            // auth state. native-bridge.mjs awaits prepare() before installing
            // its JS auth listener, so this is not interpreted as sign-out.
            do {
                try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                    auth.updateCurrentUser(privateUser) { error in
                        if let error { continuation.resume(throwing: error) }
                        else { continuation.resume(returning: ()) }
                    }
                }
            } catch {
                // Best-effort rollback prevents an interrupted migration from
                // silently replacing a signed-in customer with an empty session.
                try? auth.useUserAccessGroup(nil)
                try? await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                    auth.updateCurrentUser(privateUser) { restoreError in
                        if let restoreError { continuation.resume(throwing: restoreError) }
                        else { continuation.resume(returning: ()) }
                    }
                }
                throw error
            }
        }
        WidgetCenter.shared.reloadTimelines(ofKind: "QueTeFaltaFamilyList")
    }

    static func reload() {
        WidgetCenter.shared.reloadTimelines(ofKind: "QueTeFaltaFamilyList")
    }
}

@objc(WidgetSessionPlugin)
public final class WidgetSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetSessionPlugin"
    public let jsName = "WidgetSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "prepare", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reload", returnType: CAPPluginReturnPromise),
    ]
    private var observers: [NSObjectProtocol] = []

    public override func load() {
        observers.append(NotificationCenter.default.addObserver(
            forName: Notification.Name("SiriShoppingChanged"), object: nil, queue: .main
        ) { _ in WidgetCenter.shared.reloadTimelines(ofKind: "QueTeFaltaFamilyList") })
        observers.append(NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main
        ) { _ in WidgetCenter.shared.reloadTimelines(ofKind: "QueTeFaltaFamilyList") })
    }

    deinit {
        for observer in observers { NotificationCenter.default.removeObserver(observer) }
    }

    @objc func prepare(_ call: CAPPluginCall) {
        Task { @MainActor in
            do { try await WidgetSessionCoordinator.prepare(); call.resolve() }
            catch { call.reject("No se pudo preparar la sesión compartida del widget.", nil, error) }
        }
    }

    @objc func reload(_ call: CAPPluginCall) {
        Task { @MainActor in WidgetSessionCoordinator.reload(); call.resolve() }
    }
}
