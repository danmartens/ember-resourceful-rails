# coding: utf-8
lib = File.expand_path('../lib', __FILE__)
$LOAD_PATH.unshift(lib) unless $LOAD_PATH.include?(lib)
require 'ember-resourceful-rails/version'

Gem::Specification.new do |spec|
  spec.name          = "ember-resourceful-rails"
  spec.version       = EmberResourceful::Rails::VERSION
  spec.authors       = ["Dan Martens"]
  spec.email         = ["martens.dan@gmail.com"]
  spec.description   = %q{Ember Resourceful Rails}
  spec.summary       = %q{Adds Ember Resourceful to the Rails Asset Pipeline}
  spec.homepage      = ""
  spec.license       = "MIT"

  spec.files         = Dir["{lib,vendor}/**/*"] + ["LICENSE.txt", "README.md"]
  spec.require_paths = ["lib"]

  spec.add_development_dependency "bundler", "~> 1.3"
  spec.add_development_dependency "rake"

  spec.add_dependency "railties", ">= 3"
end
