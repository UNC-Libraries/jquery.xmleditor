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
	this.retrieveSchema(schemaLocation, function(xsdDocument) {
		// Instantiate schema processor
		var schema = new SchemaProcessor(xsdDocument, this);
		
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
		
		this.importSchema(importNode.getAttribute("schemaLocation"),
				importNode.getAttribute("namespace"));
	}
};

SchemaManager.prototype.includeSchema = function(schemaLocation, parentSchema) {
	
	// Check for duplicate include by namespace and schemaLocation
	if (parentSchema.targetNSIndex in this.includes) {
		if ($.inArray(schemaLocation, this.includes[parentSchema.targetNSIndex]) != -1)
			return;
		this.includes[parentSchema.targetNSIndex].push(schemaLocation);
	} else {
		// Register schema to includes list for duplicate/circular reference detection
		this.includes[parentSchema.targetNSIndex] = [schemaLocation];
	}
	
	// Retrieve schema document
	this.retrieveSchema(schemaLocation, function(xsdDocument) {
		// Instantiate schema processor using parents namespace
		var schema = new SchemaProcessor(xsdDocument, this, parentSchema.targetNSIndex);
		
		// Register schema to imports list as part of namespace bucket
		this.imports[parentSchema.targetNS].push(schema);
		
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
		this.includeSchema(includeNode.getAttribute("schemaLocation"), schema);
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
				elements : []
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
			schemas[i].mergeType(object, this.mergeCrossSchemaType(schemas[i].rootDefinitions[references[i]]));
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

//Process a node with tag processing functin fnName.  Follows references on the node,
//determining which schema object will be responsible for generating the definition.
//node - the node being processed
//fnName - the function to be called to process the node
//object - definition object the node belongs to
SchemaManager.prototype.execute = function(schema, node, fnName, object) {
	var resolveName = node.getAttribute("ref") || node.getAttribute("substitutionGroup") 
			|| node.getAttribute("type") || node.getAttribute("base");
	var targetNode = node;
	var xsdObj = schema;
	var name = resolveName;
	
	// Determine if the node requires resolution to another definition node
	if (resolveName != null && (schema.xsPrefix == "" && resolveName.indexOf(":") != -1) 
			|| (schema.xsPrefix != "" && resolveName.indexOf(schema.xsPrefix) == -1)) {
		// Determine which schema the reference belongs to
		var xsdObjSet = this.resolveSchema(schema, resolveName);
		
		// Extract name parts such that namespace prefix is looked up in the originating schema
		var nameParts = schema.extractName(name);
		var processingNotStarted = false;
		for (var index in xsdObjSet) {
			xsdObj = xsdObjSet[index];
			
			//Check for cached version of the definition
			if (nameParts.indexedName in xsdObj.rootDefinitions){
				var definition = xsdObj.rootDefinitions[nameParts.indexedName];
				if (definition != null) {
					return definition;
				}
			}
			
			// Schema reference is not initialized yet, therefore it is a circular reference, store stub
			processingNotStarted = !xsdObj.processingStarted && xsdObj !== this;
			if (processingNotStarted) {
				continue;
			}
			
			// Grab the node the reference was referring to
			targetNode = xsdObj.getChildren(xsdObj.xsd, undefined, nameParts.localName);
			if (targetNode && targetNode.length > 0) {
				targetNode = targetNode[0];
				break;
			}
		}
		if (processingNotStarted) {
			return {name: nameParts.indexedName, schemaObject : xsdObjSet, reference : [nameParts.indexedName]};
		}
	} 
	
	try {
		// Call the processing function on the referenced node
		return xsdObj[fnName](targetNode, object);
	} catch (error) {
		$("body").append("<br/>" + name + ": " + error + " ");
		throw error;
	}
};



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