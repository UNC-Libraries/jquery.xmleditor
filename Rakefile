require "rubygems"
require "sprockets"

task :default => FileList.new("src/*") do
  environment = Sprockets::Environment.new
  environment.append_path "src"
  environment.register_bundle_processor "application/javascript", :wrap_source do |context, data|
    ";(function($){#{data}})(jQuery);"
  end
  
  File.open("jquery.modseditor.js", "w+") do |f|
    f << environment.find_asset("jquery.modseditor.js").to_s
  end
end

task :clean do
  FileUtils.rm_f("jquery.modseditor.js")
end
