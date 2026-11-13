require 'xcodeproj'
root=ARGV.fetch(0)
p=Xcodeproj::Project.new("#{root}/NativeCapture.xcodeproj")
host=p.new_target(:application,'CaptureHost',:ios,'15.0')
host.add_file_references([p.main_group.new_file('CaptureHost/App.swift')])
tests=p.new_target(:ui_test_bundle,'CaptureTests',:ios,'15.0')
tests.add_file_references([p.main_group.new_file('CaptureTests/Capture.swift')])
tests.add_dependency(host)
[host,tests].each do |t|
 t.build_configurations.each do |c|
  c.build_settings.merge!({'SWIFT_VERSION'=>'5.0','GENERATE_INFOPLIST_FILE'=>'YES','CODE_SIGNING_ALLOWED'=>'NO','TARGETED_DEVICE_FAMILY'=>'1,2','PRODUCT_BUNDLE_IDENTIFIER'=>"com.cgtygrss.capture.#{t.name.downcase}", 'IPHONEOS_DEPLOYMENT_TARGET'=>'15.0'})
 end
end
host.build_configurations.each{|c|c.build_settings['INFOPLIST_KEY_UISupportedInterfaceOrientations']='UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight'}
tests.build_configurations.each{|c|c.build_settings['TEST_TARGET_NAME']='CaptureHost'}
p.save
scheme=Xcodeproj::XCScheme.new
scheme.add_build_target(host)
scheme.add_build_target(tests)
scheme.add_test_target(tests)
scheme.set_launch_target(host)
scheme.save_as(p.path,'NativeCapture',true)
