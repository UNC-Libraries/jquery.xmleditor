require "rubygems"
require "sprockets"

task :default => "jquery.xmleditor.js"

task "jquery.xmleditor.js" => FileList.new("src/*") do
  environment = Sprockets::Environment.new
  environment.append_path "src"
  
  File.open("jquery.xmleditor.js", "w+") do |f|
    f << ";(function($){" + environment.find_asset("jquery.xmleditor.js").to_s + "})(jQuery);"
  end
end

task "xsd2json.js" => FileList.new("xsd/src/*") do
  environment = Sprockets::Environment.new
  environment.append_path "xsd/src"
  
  File.open("xsd/xsd2json.js", "w+") do |f|
    f << ";var Xsd2Json = function() {" + environment.find_asset("xsd2json.js").to_s + "; return Xsd2Json;}.call();"
  end
end

task "mods.js" do
  FileUtils.cd("xsd")
  system "phantomjs build.js ../mods.js"
end

task :clean do
  FileUtils.rm_f("jquery.xmleditor.js")
end
