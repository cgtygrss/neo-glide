require 'tmpdir'
require 'fileutils'
require 'json'
require 'fastlane'
require 'fastlane/actions/upload_to_testflight'
require 'fastlane/actions/upload_to_play_store'
require 'fastlane/actions/upload_to_app_store'
require 'fastlane/actions/app_store_connect_api_key'

# Validate against the installed, locked Fastlane schemas before stubbing only
# outbound execution. A permissive stub hid an unsupported Android parameter.
$action_options = {
  upload_to_testflight: Fastlane::Actions::UploadToTestflightAction,
  upload_to_play_store: Fastlane::Actions::UploadToPlayStoreAction,
  upload_to_app_store: Fastlane::Actions::UploadToAppStoreAction,
  app_store_connect_api_key: Fastlane::Actions::AppStoreConnectApiKeyAction
}.transform_values { |action| action.available_options.map(&:key) }
def validate_options(name, options)
  unknown = options.keys - $action_options.fetch(name)
  raise "Unsupported #{name} options: #{unknown.join(', ')}" unless unknown.empty?
end

module UI
  def self.user_error!(message) = raise(message)
end
$lanes = {}
$calls = []
def lane(name, &block) = $lanes[name] = block
def app_store_connect_api_key(**options)
  validate_options(:app_store_connect_api_key, options)
  {}
end
[:upload_to_testflight, :upload_to_play_store, :upload_to_app_store].each do |name|
  define_method(name) do |**options|
    validate_options(name, options)
    $calls << [name, options]
  end
end
def rejected
  begin
    yield
  rescue RuntimeError
    return
  end
  raise 'Unsafe lane accepted the wrong manifest'
end

source=File.expand_path('../../fastlane/Fastfile',__dir__)
Dir.mktmpdir('neo-fastlane-test') do |root|
  FileUtils.mkdir_p(["#{root}/fastlane","#{root}/ci-output","#{root}/ci/changes/1.3.0"])
  FileUtils.cp(source,"#{root}/fastlane/Fastfile")
  File.write("#{root}/ci/changes/1.3.0/en-GB.txt",'Test')
  File.write("#{root}/ci/release.json",JSON.generate({'androidPackage'=>'com.cgtygrss.neoglide','androidTrack'=>'alpha'}))
  load "#{root}/fastlane/Fastfile"
  ENV['ASC_KEY_ID']='test';ENV['ASC_ISSUER_ID']='test';ENV['ASC_PRIVATE_KEY_BASE64']='test';ENV['GOOGLE_APPLICATION_CREDENTIALS']='test'
  identity={'mode'=>'device-test','track'=>'internal','version'=>'1.3.0','build'=>'103'}
  File.write("#{root}/ci-output/identity.json",JSON.generate(identity))
  File.write("#{root}/ci-output/store-snapshot.json",JSON.generate({'iosExists'=>false,'androidExists'=>false}))
  $lanes[:test_ios].call
  name,options=$calls.pop
  raise 'Unsafe iOS test distribution' unless name==:upload_to_testflight && options[:skip_submission] && !options[:distribute_external]
  $lanes[:test_android].call
  name,options=$calls.pop
  raise 'Fresh Play test upload missing' unless name==:upload_to_play_store && options[:track]=='internal' && !options[:skip_upload_aab] && options[:aab]
  File.write("#{root}/ci-output/store-snapshot.json",JSON.generate({'iosExists'=>true,'androidExists'=>true}))
  $lanes[:test_ios].call
  raise 'Existing iOS build uploaded again' unless $calls.empty?
  $lanes[:test_android].call
  name,options=$calls.pop
  raise 'Unsafe Play test distribution' unless name==:upload_to_play_store && options[:track]=='internal' && options[:skip_upload_aab]
  rejected { $lanes[:publish_ios].call }
  rejected { $lanes[:publish_android].call }
  File.write("#{root}/ci-output/identity.json",JSON.generate(identity.merge('track'=>'production')))
  rejected { $lanes[:test_android].call }
  File.write("#{root}/ci-output/identity.json",JSON.generate(identity.merge('mode'=>'publish','track'=>'alpha')))
  rejected { $lanes[:test_ios].call }
  rejected { $lanes[:test_android].call }
  $lanes[:publish_ios].call
  name,options=$calls.pop
  raise 'Normal publishing behavior changed' unless name==:upload_to_app_store && options[:automatic_release] && options[:submit_for_review]
  $lanes[:publish_android].call
  name,options=$calls.pop
  raise 'Normal Play publishing behavior changed' unless name==:upload_to_play_store && options[:track]=='alpha' && options[:release_status]=='completed'
end
puts 'Fastlane device/public distribution boundaries and upload retry verified.'
