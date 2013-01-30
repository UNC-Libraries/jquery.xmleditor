require "rubygems"
require "sprockets"

task :default => "jquery.modseditor.js"

task "jquery.modseditor.js" => FileList.new("src/*") do
  environment = Sprockets::Environment.new
  environment.append_path "src"
  
  File.open("jquery.modseditor.js", "w+") do |f|
    f << ";(function($){" + environment.find_asset("jquery.modseditor.js").to_s + "})(jQuery);"
  end
end

task "mods.js" do
  FileUtils.cd("xsd")
  system "phantomjs build.js ../mods.js"
end

task :clean do
  FileUtils.rm_f("jquery.modseditor.js")
end
