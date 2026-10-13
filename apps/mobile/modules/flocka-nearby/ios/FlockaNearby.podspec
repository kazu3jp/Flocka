Pod::Spec.new do |s|
  s.name           = 'FlockaNearby'
  s.version        = '1.0.0'
  s.summary        = 'Foreground BLE invitation discovery for Flocka'
  s.description    = 'Advertises expiring invitations over GATT and discovers nearby participants.'
  s.author         = 'kazu3jp'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: 'https://github.com/kazu3jp/Flocka.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
