Pod::Spec.new do |s|
  s.name = 'VigorHealth'
  s.version = '1.0.0'
  s.summary = 'Local, write-only Vigor workout export.'
  s.description = s.summary
  s.license = { :type => 'MIT' }
  s.author = 'Vigor'
  s.homepage = 'https://docs.expo.dev/modules/'
  s.platform = :ios, '16.4'
  s.source = { :path => '.' }
  s.static_framework = true
  s.swift_version = '5.9'
  s.source_files = '**/*.swift'
  s.resources = 'Resources/rest-chime.wav'
  s.frameworks = 'HealthKit', 'CryptoKit', 'AVFAudio', 'AudioToolbox', 'UIKit'
  s.dependency 'ExpoModulesCore'
end
