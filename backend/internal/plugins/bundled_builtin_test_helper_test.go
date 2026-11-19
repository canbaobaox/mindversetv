package plugins

import "testing"

// useShippedLL2YsduiForTest temporarily treats the on-demand ll2/ysdui
// plugins as shipped builtins so their provider contracts and the builtin
// hot-update mechanism can be exercised in tests. The desktop app ships
// only beeftv-plugin-market; ll2/ysdui stay installable online and are not
// bundled into the installer. The shipped set itself is asserted by
// TestPluginViewIncludesDocumentationForEveryOfficialProtocol.
func useShippedLL2YsduiForTest(t *testing.T) {
	t.Helper()
	prev := BundledBuiltinPluginNames
	BundledBuiltinPluginNames = []string{"beeftv-plugin-market", "beeftv-plugin-ll2", "beeftv-plugin-ysdui"}
	t.Cleanup(func() { BundledBuiltinPluginNames = prev })
}
