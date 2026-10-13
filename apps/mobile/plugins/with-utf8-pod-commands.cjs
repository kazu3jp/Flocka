const { withPodfile } = require("expo/config-plugins");

// CocoaPods captures subprocess output as binary. React Native then combines
// Node's UTF-8 absolute paths with Ruby UTF-8 strings, failing in Japanese paths.
const RUBY_PATCH = `
# Flocka: preserve UTF-8 paths returned by CocoaPods subprocesses.
module FlockaUtf8PodCommands
  def execute_command(*arguments, **options)
    output = super
    utf8 = output.dup.force_encoding(Encoding::UTF_8)
    utf8.valid_encoding? ? utf8 : output
  end
end
Pod::Executable.singleton_class.prepend(FlockaUtf8PodCommands)
`;

module.exports = function withUtf8PodCommands(config) {
  return withPodfile(config, (mod) => {
    if (!mod.modResults.contents.includes("module FlockaUtf8PodCommands")) {
      mod.modResults.contents = RUBY_PATCH + "\n" + mod.modResults.contents;
    }
    return mod;
  });
};
