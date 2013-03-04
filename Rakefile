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

task "mods.js" do
  FileUtils.cd("xsd")
  system "phantomjs build.js ../mods.js"
end

task :clean do
  FileUtils.rm_f("jquery.xmleditor.js")
end
