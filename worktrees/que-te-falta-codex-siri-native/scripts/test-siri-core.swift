import Foundation
import JavaScriptCore

// Exercise the packaged JS on Apple's actual engine, not just Node/V8.
let context = JSContext()!
context.evaluateScript(try String(contentsOfFile: "www/siri-core.js", encoding: .utf8))
precondition(context.exception == nil, "The Siri bundle must load in JavaScriptCore")
let result = context.evaluateScript("SiriShopping.planSiriAddition({}, 'dos kilos de patatas', [], 'native-test', 1780000000000)")!
precondition(context.exception == nil)
precondition(JSONSerialization.isValidJSONObject(result.objectForKeyedSubscript("state")!.toDictionary()!))
let items = result.objectForKeyedSubscript("state")!.objectForKeyedSubscript("items")!
precondition(items.atIndex(0)!.objectForKeyedSubscript("key")!.toString() == "patata")
precondition(items.atIndex(0)!.objectForKeyedSubscript("quantity")!.toInt32() == 2)
context.setObject(result.objectForKeyedSubscript("state")!, forKeyedSubscript: "saved" as NSString)
let duplicate = context.evaluateScript("SiriShopping.planSiriAddition(saved, 'patatas', [], 'second', 1780000000000)")!
precondition(duplicate.objectForKeyedSubscript("duplicates")!.toArray().count == 1)
context.setObject(duplicate, forKeyedSubscript: "duplicate" as NSString)
let confirmed = context.evaluateScript("SiriShopping.planSiriAddition(saved, 'patatas', [duplicate.duplicates[0].fingerprint], 'second', 1780000000000)")!
precondition(confirmed.objectForKeyedSubscript("duplicates")!.toArray().isEmpty)
precondition(context.exception == nil)
print("Siri JavaScriptCore: parsing, quantities and duplicate confirmation passed")
