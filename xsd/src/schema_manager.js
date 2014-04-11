/**
 * Manages processing of a set of schemas to produce a single resulting
 * tree of elements
 * 
 * @author bbpennel
 */
function SchemaManager(originatingXsdName, options) {
	var defaults = {
			rootElement : undefined,
			globalNamespaces : {}
	};
	
	this.options = $.extend({}, defaults, options);
	
	var self = this;
	
	this.isHttpUrl = new RegExp(/^https?:\/\//);
	
	// Map of schema processors for imported schemas.  Stored by namespace
	this.imports = {};
	// Map of schema processors for included schemas.  Stored by schemaLocation
	this.includes = {};
	
	// Reference to the schema object being used as the starting schema
	this.originatingSchema = null;
	// Root element of the originating schema
	this.originatingRoot = null;
	
	// Shared namespace index registry, used by all schemas being processed
	this.namespaceIndexes = [];
	
	this.xsNS = "http://www.w3.org/2001/XMLSchema";
	
	/// Registering the "special" namespaces that are automatically added by web browsers
	this.globalNamespaces = $.extend({}, options.globalNamespaces, {
		"xml" : "http://www.w3.org/XML/1998/namespace",
		"xmlns" : "http://www.w3.org/2000/xmlns/",
		"html" : "http://www.w3.org/1999/xhtml/"
	});
	
	$.each(this.globalNamespaces, function(prefix, namespaceUri) {
		self.registerNamespace(namespaceUri);
	});
	
	// Load in the orginating schema and start processing from there
	this.importSchema(this.computeSchemaLocation(originatingXsdName));
	
	// Establish originatingRoot reference
	this.setOriginatingRoot();
	
	this.resolveTypeReferences(this.originatingRoot);
	
	// Add namespace uris into the final schema object
	this.exportNamespaces();
};

SchemaManager.prototype.retrieveSchema = function(url, callback) {
	this.importAjax(url, callback);
};

SchemaManager.prototype.importAjax = function(url, callback, failedLocalAttempt) {
	var self = this;
	var isHttpRequest = url.match(this.isHttpUrl);
	var schemaPath = url;
	// Try http urls as local calls first since the full urls generally fail
	if (isHttpRequest && !failedLocalAttempt)
		schemaPath = self.options.schemaURI + url.substring(url.lastIndexOf("/") + 1);
	
	$.ajax({
		url: schemaPath,
		dataType: "text",
		async: false,
		success: function(data){
			var xsdDocument = $.parseXML(data).documentElement;
			callback.call(self, xsdDocument, url);
		}, error: function() {
			if (!isHttpRequest || failedLocalAttempt)
				throw new Error("Unable to import " + url);
			// Try treating as a relative url since original path wasn't retrievable
			self.importAjax(url, callback, true);
		}
	});
};

SchemaManager.prototype.computeSchemaLocation = function(url, parentSchema) {
	if (!url)
		return null;
	
	var isNotRelative = url.match(this.isHttpUrl);
	if (isNotRelative) {
		return url;
	} else {
		if (parentSchema && parentSchema.schemaPath) {
			// Path relative to its parent
			return parentSchema.schemaPath + url;
		} else if (this.options.schemaURI) {
			// No parent path, so use go relative to base schema uri
			return this.options.schemaURI + url;
		}
	}
};

/**
 * Only one schema per namespace will be imported.  All future namespaces imported into the 
 * same schema are ignored.
 * Provided namespaceUri is favored over the target namespace in the imported schema.
 */
SchemaManager.prototype.importSchema = function(schemaLocation, namespaceUri) {
	
	// Namespace already imported, circular import or already imported by another schema
	if (namespaceUri in this.imports)
		return;
	
	// Retrieve schema document
	this.retrieveSchema(schemaLocation, function(xsdDocument, schemaUrl) {
		// Instantiate schema processor
		var schema = new SchemaProcessor(xsdDocument, this, schemaUrl);
		
		// Register schema
		if (namespaceUri)
			this.imports[namespaceUri] = [schema];
		else {
			// Discard schema if another schema was already imported in its target namespace
			if (schema.targetNS in this.imports)
				return;
			this.imports[schema.targetNS] = [schema];
		}
		
		// Store the first schema picked up as the originating schema
		if (!this.originatingSchema)
			this.originatingSchema = schema;
		
		// Process imported schemas before processing this one
		this.processImports(schema);
		this.processIncludes(schema);
		
		// Process the target schema
		schema.processSchema();
	});
};

SchemaManager.prototype.processImports = function(schema) {
	// Load all of the imported schemas
	var imports = schema.getChildren(schema.xsd, 'import');

	for (var index in imports) {
		var importNode = imports[index];
		var importNamespace = importNode.getAttribute('namespace');
		var schemaLocation = 
			this.computeSchemaLocation(importNode.getAttribute("schemaLocation"), schema);
		
		this.importSchema(schemaLocation, importNode.getAttribute("namespace"));
	}
};

SchemaManager.prototype.includeSchema = function(schemaLocation, namespaceIndex) {
	
	// Check for duplicate include by namespace and schemaLocation
	if (namespaceIndex in this.includes) {
		if ($.inArray(schemaLocation, this.includes[namespaceIndex]) != -1)
			return;
		this.includes[namespaceIndex].push(schemaLocation);
	} else {
		// Register schema to includes list for duplicate/circular reference detection
		this.includes[namespaceIndex] = [schemaLocation];
	}
	
	// Retrieve schema document
	this.retrieveSchema(schemaLocation, function(xsdDocument, schemaUrl) {
		// Instantiate schema processor using parents namespace
		var schema = new SchemaProcessor(xsdDocument, this, schemaUrl, namespaceIndex);
		
		// Register schema to imports list as part of namespace bucket
		this.imports[this.getNamespaceUri(namespaceIndex)].push(schema);
		
		// Process imported schemas before processing this one
		this.processImports(schema);
		this.processIncludes(schema);
		
		// Process the target schema
		schema.processSchema();
	});
};

SchemaManager.prototype.processIncludes = function(schema) {
	// Load all of the imported schemas
	var includes = schema.getChildren(schema.xsd, 'include');

	for (var index in includes) {
		var includeNode = includes[index];
		var schemaLocation =
			this.computeSchemaLocation(includeNode.getAttribute("schemaLocation"),
					schema);
		
		this.includeSchema(schemaLocation, schema.targetNSIndex);
	}
};

SchemaManager.prototype.setOriginatingRoot = function() {

	// Select root element if one is specified
	if (this.options.rootElement != null) {
		this.originatingRoot = this.originatingSchema.root;
		
		for (var index in this.originatingRoot.elements) {
			var topLevelElement = this.originatingRoot.elements[index];
			
			if (this.options.rootElement != topLevelElement.name) {
				this.originatingRoot = topLevelElement;
			}
		}
	} else {
		this.originatingRoot = {
				schema : true,
				ns : this.originatingSchema.targetNSIndex,
				namespaces : [],
				elements : [],
				np : true
			};
		
		for (var ns in this.imports) {
			var importSet = this.imports[ns];
			
			for (var index in importSet) {
				var schema = importSet[index];
				
				for (var elIndex in schema.root.elements) {
					this.originatingRoot.elements.push(schema.root.elements[elIndex]);
				}
			}
		}
	}
};

SchemaManager.prototype.mergeRootLevelElements = function() {
	for (var ns in this.imports) {
		var importSet = this.imports[ns];
		
		for (var index in importSet) {
			var schema = importSet[index];
			
			for (var elIndex in schema.root.elements) {
				this.originatingRoot.elements.push(schema.root.elements[elIndex]);
			}
		}
	}
};

SchemaManager.prototype.exportNamespaces = function() {

	// Add all the namespaces from imported schemas into the registry of namespaces for the root schema
	var namespaceRegistry = [];
	for (var index in this.namespaceIndexes) {
		var namespaceUri = this.namespaceIndexes[index];
		$.each(this.originatingSchema.localNamespaces, function(key, val){
			if (val == namespaceUri) {
				namespaceRegistry.push({'prefix' : key, 'uri' : val});
				return false;
			}
		});
	}
	
	this.originatingRoot.namespaces = namespaceRegistry;
};

//Post processing step which recursively walks the schema tree and merges type definitions
//into elements that reference them.
SchemaManager.prototype.resolveTypeReferences = function(definition) {
	
	// Prevent processing the same object more than once
	if (definition.np)
		delete definition.np;
	else
		return definition;

	if (definition.ref) {
		var ref = definition.ref;
		delete definition.ref;
		
		var refDef = this.resolveDefinition(ref);
		if (!refDef)
			throw new Error("Could not resolve reference " + ref 
					+ " from definition " + definition.name);
		
		// Compute nested types depth first before merging in this type
		this.resolveTypeReferences(refDef);
		
		this.mergeRef(definition, refDef);
	} else {
		// Process children
		var self = this;
		if (definition.elements) {
			$.each(definition.elements, function(){
				self.resolveTypeReferences(this);
			});
		}
		if (definition.attributes != null) {
			$.each(definition.attributes, function(){
				self.resolveTypeReferences(this);
			});
		}
		
		if (definition.typeRef) {
			// Merge in any type references
			var typeRefs = definition.typeRef;
			delete definition.typeRef;
			
			for (var index in typeRefs) {
				var typeRef = typeRefs[index];
				
				// Find the definition being referenced across all schemas
				var typeDef = this.resolveDefinition(typeRef);
				if (!typeDef)
					throw new Error("Could not resolve reference to type " + typeRef 
							+ " from definition " + definition.name);
				
				// Compute nested types depth first before merging in this type
				this.resolveTypeReferences(typeDef);
				
				this.mergeType(definition, typeDef);
			}
		}
	}
};

SchemaManager.prototype.resolveDefinition = function(indexedName) {
	var index = indexedName.substring(0, indexedName.indexOf(":"));
	
	var schemaSet = this.imports[this.getNamespaceUri(index)];
	for (var index in schemaSet) {
		var schema = schemaSet[index];
		
		//Check for cached version of the definition
		if (indexedName in schema.rootDefinitions){
			var definition = schema.rootDefinitions[indexedName];
			if (definition != null) {
				return definition;
			}
		}
	}
};

/**
 * Inspects the reference name and returns the set of schema objects that
 * correspond to its namespace
 */
SchemaManager.prototype.resolveSchema = function(schema, name) {
	if (name != null){
		var index = name.indexOf(":");
		var prefix = index == -1? "": name.substring(0, index);
		var namespace = schema.localNamespaces[prefix];
		var xsdObj = this.imports[namespace];
		if (xsdObj == null)
			xsdObj = [schema];
		return xsdObj;
	}
	return this;
};

SchemaManager.prototype.mergeType = function(base, type) {
	for (var key in type) {
		if (type.hasOwnProperty(key)) {
			var value = type[key];
			if (value != null && base[key] == null){
				base[key] = value;
			} else if ($.isArray(value) && $.isArray(type[key])){
				base[key] = base[key].concat(value);
			}
		}
	}
};

SchemaManager.prototype.mergeRef = function(base, ref) {
	if (ref.name)
		base.name = ref.name;
	base.ns = ref.ns;
	
	this.mergeType(base, ref);
}

//Register a namespace if it is new
SchemaManager.prototype.registerNamespace = function(namespaceUri) {
	var namespaceIndex = $.inArray(namespaceUri, this.namespaceIndexes);
	if (namespaceIndex == -1) {
		this.namespaceIndexes.push(namespaceUri);
		return this.namespaceIndexes.length - 1;
	}
	
	return namespaceIndex;
};

SchemaManager.prototype.getNamespaceIndex = function(namespaceUri) {
	return $.inArray(namespaceUri, this.namespaceIndexes);
};

SchemaManager.prototype.getNamespaceUri = function(index) {
	return this.namespaceIndexes[index];
};