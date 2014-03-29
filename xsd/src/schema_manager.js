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
	this.importSchema(originatingXsdName);
	
	// Establish originatingRoot reference
	this.setOriginatingRoot();
	
	// Resolve dangling external schema types from circular includes
	this.resolveCrossSchemaTypeReferences(this.originatingRoot, []);
	
	// Add namespace uris into the final schema object
	this.exportNamespaces();
	
	// createSchema 
	// importSchema - imports a schema with a namespace
	// includeSchema - imports a schema into an existing schema with namespace
};

SchemaManager.prototype.retrieveSchema = function(url, callback) {
	this.importAjax(url, false, callback);
};

SchemaManager.prototype.importAjax = function(url, originalAttempt, callback) {
	var originalURL = url,
			self = this;
	// Prefer a local copy to the remote since likely can't get the remote copy due to cross domain ajax restrictions
	if (!originalAttempt)
		url = this.options.schemaURI + url.substring(url.lastIndexOf("/") + 1);
	
	$.ajax({
		url: url,
		dataType: "text",
		async: false,
		success: function(data){
			var xsdDocument = $.parseXML(data).documentElement;
			callback.call(self, xsdDocument);
		}, error: function() {
			if (!originalAttempt)
				throw new Error("Unable to import " + url);
			self.importAjax(originalURL, true, callback);
		}
	});
};

SchemaManager.prototype.importSchema = function(schemaLocation, namespaceUri) {
	
	// Retrieve schema document
	this.retrieveSchema(schemaLocation, function(xsdDocument) {
		// Instantiate schema processor
		var schema = new SchemaProcessor(xsdDocument, this);
		
		// Register schema
		if (namespaceUri)
			this.imports[namespaceUri] = schema;
		else
			this.imports[schema.targetNS] = schema;
		
		// Store the first schema picked up as the originating schema
		if (!this.originatingSchema)
			this.originatingSchema = schema;
		
		// Process imported schemas before processing this one
		this.processImports(schema);
		
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
		if (importNamespace in this.imports) {
			// Circular import or already imported by another schema
		} else {
			this.importSchema(importNode.getAttribute("schemaLocation"),
					importNode.getAttribute("namespace"));
		}
	}
};

SchemaManager.prototype.setOriginatingRoot = function() {
	//Establish originatingRoot reference
	this.originatingRoot = this.originatingSchema.root;
	
	// Select root element if one is specified
	if (this.options.rootElement != null) {
		for (var index in this.originatingRoot.elements) {
			var topLevelElement = this.originatingRoot.elements[index];
			
			if (this.options.rootElement != topLevelElement.name) {
				this.originatingRoot = topLevelElement;
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

//Detect if the given object referenced a type from a schema which was not available at the time
//it was originally being processed.  If so, then merge the definition with the definition from
//the external schema.
SchemaManager.prototype.mergeCrossSchemaType = function(object) {
	if (object.schemaObject) {
		var schemas = object.schemaObject;
		var references = object.reference;
		// Clean up the cross schema references
		delete object.schemaObject;
		delete object.reference;
		// Merge in the external schema types, recursively merging together the external schema types
		for (var i = 0; i < schemas.length; i++){
			this.mergeType(object, this.mergeCrossSchemaType(schemas[i].rootDefinitions[references[i]]));
		}
	}
	return object;
};

//Walk the schema tree to resolve dangling cross schema definitions, which are created as stubs 
//when circular schema includes are detected.
//This is only performed once ALL schemas have been processed and local types resolved
SchemaManager.prototype.resolveCrossSchemaTypeReferences = function(object, objectStack) {
	this.mergeCrossSchemaType(object);
	if (object.element || object.schema) {
		if (object.elements) {
			objectStack.push(object);
			for (var i in object.elements) 
				if ($.inArray(object.elements[i], objectStack) == -1)
					this.resolveCrossSchemaTypeReferences(object.elements[i], objectStack);
			objectStack.pop();
		}
		// Resolve attribute definitions
		for (var i in object.attributes) 
			this.resolveCrossSchemaTypeReferences(object.attributes[i]);
	}
};

//Register a namespace if it is new
SchemaManager.prototype.registerNamespace = function(namespaceUri) {
	if ($.inArray(namespaceUri, this.namespaceIndexes) == -1)
		this.namespaceIndexes.push(namespaceUri);
};

SchemaManager.prototype.getNamespaceIndex = function(namespaceUri) {
	return $.inArray(namespaceUri, this.namespaceIndexes);
};