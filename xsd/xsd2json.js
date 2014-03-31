;var Xsd2Json = function() {

/*

    Copyright 2008 The University of North Carolina at Chapel Hill

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License atthis

            http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

 */
/*
 * Converts xml schemas to usable json objects, focused on elements and attributes.  Result is a javascript
 * object representing a starting node from the base schema, with recursive relations to all its children
 * and attributes.  The resulting structure can then be used or exported.
 * 
 * Intended for populating forms rather than validation.  Not all restrictions are extracted at this time.
 * 
 * Due to cross browser domain restrictions on ajax calls, the schema and its imports must all
 * be stored within the same domain as this script.
 * 
 * @author Ben Pennell
 */

function Xsd2Json(originatingXsdName, options) {
	var defaults = {
		schemaURI: "",
		rootElement: null
	};
	this.options = $.extend({}, defaults, options);
	
	this.xsdManager = new SchemaManager(originatingXsdName, options);

};

Xsd2Json.prototype.getSchema = function() {
	var self = this;
	return function() {
		return self.xsdManager.originatingRoot;
	};
};

/**
 * Converts the computed schema object into JSON and returns as a string.  If pretty is
 * true, then the json will use pretty formatting.
 * @param pretty
 * @returns
 */
Xsd2Json.prototype.stringify = function(pretty) {
	if (this.xsdManager.originatingRoot == null)
		throw new Error("Root element was not set, cannot convert to JSON.");
	if (pretty) {
		return vkbeautify.json(JSON.stringify(JSON.decycle(this.xsdManager.originatingRoot)));
	}
	return JSON.stringify(JSON.decycle(this.xsdManager.originatingRoot));
};

/**
 * Creates a file named <filename> from the computed schema object, converted to JSON.
 * If variableName is provided, then the JSON will be output so that it is assigned to a variable of
 * the same name in the exported JSON file.  Allows for caching to a file without needing to use eval to reload.
 * If pretty is provided, the json will use pretty formatting.
 * @param filename
 * @param variableName
 * @param pretty
 * @returns {Boolean}
 */
Xsd2Json.prototype.exportJSON = function(filename, variableName, pretty) {
	// JSON versus JS
	window.URL = window.webkitURL || window.URL;
	window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder;
	
	if (window.BlobBuilder === undefined) {
		alert("Browser does not support saving files.");
		return false;
	}
	
	var jsonString = this.stringify(pretty);
	if (variableName != null){
		jsonString = "var " + variableName + " = " + jsonString + ";";
	}
	var blobBuilder = new BlobBuilder();
	blobBuilder.append(jsonString);
	
	var mimeType = "application/json";
	
	var a = document.createElement('a');
	a.download = filename;
	a.href = window.URL.createObjectURL(blobBuilder.getBlob(mimeType));
	
	a.dataset.downloadurl = [mimeType, a.download, a.href].join(':');
	a.target = "exportJSON";
	
	var event = document.createEvent("MouseEvents");
	event.initMouseEvent(
		"click", true, false, window, 0, 0, 0, 0, 0
		, false, false, false, false, 0, null
	);
	a.dispatchEvent(event);
};
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

	//this.mergeRootLevelElements();
	
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
/**
 * Processes an XML schema, extracting key features and storing them into
 * javascript structures.
 * 
 * @author bbpennel
 */

/**
 * xsdDocument XML document representaton of the schema document to be processed
 * xsdManager schema manager which this processor belongs to
 */

function SchemaProcessor(xsdDocument, xsdManager, parentNSIndex) {
	
	this.xsd = xsdDocument;
	this.xsdManager = xsdManager;
	
	// Object definitions defined at the root level of the schema
	this.rootDefinitions = {};
	this.types = {};
	
	// Local namespace prefix registry
	this.localNamespaces = $.extend({}, this.xsdManager.globalNamespaces);

	this.xsPrefix = "xs:";
	
	if (parentNSIndex !== undefined) {
		this.targetNSIndex = parentNSIndex;
		this.targetNS = this.xsdManager.getNamespaceUri(parentNSIndex);
	} else {
		// The target namespace for this schema
		this.targetNS = null;
		// The index of the target namespace in namespaceIndexes
		this.targetNSIndex = null;
	}
	
	// Root definition for this schema, either an element or a schema object
	this.root = null;
	
	this.extractNamespaces();
};

// Process the schema file to extract its structure into javascript objects
SchemaProcessor.prototype.processSchema = function() {

	try {
		// Flag indicating that this schema 
		this.processingStarted = true;
		
		// Begin constructing the element tree, starting from the schema element
		this.root = this.buildSchema(this.xsd);

		// Resolve dangling type references
		this.resolveTypeReferences(this.root, []);
	} catch (e) {
		console.log(e);
	}
};

SchemaProcessor.prototype.extractNamespaces = function() {
	
	for (var i = 0; i < this.xsd.attributes.length; i++) {
		var attr = this.xsd.attributes[i];
		if (!attr.specified)
			continue;
		
		var namespaceIndex = attr.nodeName.indexOf("xmlns");
		if (namespaceIndex == 0){
			var namespacePrefix = attr.nodeName.substring(5).replace(":", "");
			var namespaceUri = attr.nodeValue;
			this.registerNamespace(namespaceUri, namespacePrefix);
			
			// Store the namespace prefix for the xs namespace
			if (attr.nodeValue == this.xsdManager.xsNS){
				this.xsPrefix = namespacePrefix;
				if (this.xsPrefix != "")
					this.xsPrefix = this.xsPrefix + ":";
			}
		}
	}
	
	// Only use target namespace if not already being provided with a namespace uri
	if (!this.targetNS) {
		// Store the target namespace of this schema.
		this.targetNS = this.xsd.getAttribute("targetNamespace");
		
		// Determine if the targetNS is already registered locally
		var localPrefix = this.getLocalNamespacePrefix(this.targetNS);
		if (localPrefix == null) {
			// Register the target namespace as the default namespace, even if there was already a default ns
			this.targetNSIndex = this.registerNamespace(this.targetNS, "");
		} else {
			this.targetNSIndex = this.xsdManager.getNamespaceIndex(this.targetNS);
		}
	}
	
	// Register the target ns as the default ns if none was specified
	if (!("" in this.localNamespaces)) {
		this.localNamespaces[""] = this.targetNS;
	}
};

// Post processing step which recursively walks the schema tree and merges type definitions
// into elements that reference them.
SchemaProcessor.prototype.resolveTypeReferences = function(object, objectStack) {
	if (object.typeRef == null) {
		// Since this object did not have a type reference, continue to walk its children
		if (object.element || object.schema) {
			var self = this;
			if (object.elements) {
				objectStack.push(object);
				$.each(object.elements, function(){
					if ($.inArray(this, objectStack) == -1)
						self.resolveTypeReferences(this, objectStack);
				});
				objectStack.pop();
			}
			if (object.attributes != null) {
				$.each(object.attributes, function(){
					self.resolveTypeReferences(this);
				});
			}
		}
	} else {
		// If there was a type definition on this object, merge it in and stop to avoid infinite loops
		var typeDef = object.typeRef;
		delete object.typeRef;
		this.mergeType(object, typeDef);
	}
};

// Build the schema tag
SchemaProcessor.prototype.buildSchema = function(node) {
	var object = {
		"elements": [],
		"ns": this.targetNSIndex,
		"schema": true
	};
	var self = this;
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		if (child.localName == 'element')
			this.buildElement(child, object);
	}
	return object;
};

// Build an element definition
// node - element schema node
// parentObject - definition of the parent this element will be added to
SchemaProcessor.prototype.buildElement = function(node, parentObject) {
	var definition = null;
	var name = node.getAttribute("name");
	var nameParts = this.extractName(name);
	var parentIsSchema = node.parentNode === this.xsd;
	
	if (parentIsSchema) {
		// Detect if this element is already defined in the list of root definitions, if so use that
		if (nameParts && nameParts.indexedName in this.rootDefinitions)
			return this.rootDefinitions[nameParts.indexedName];
	} else {
		// Store min/max occurs on the the elements parent, as they only apply to this particular relationship
		// Root level elements can't have min/max occurs attributes
		var minOccurs = node.getAttribute("minOccurs");
		var maxOccurs = node.getAttribute("maxOccurs");
		if (parentObject && (minOccurs || maxOccurs)) {
			var nameOrRefParts = nameParts? nameParts : this.extractName(node.getAttribute("ref"));
			if (!("occurs" in parentObject))
				parentObject.occurs = {};
			parentObject.occurs[nameOrRefParts.indexedName] = {
					'min' : minOccurs,
					'max' : maxOccurs
			};
		}
	}
	
	var hasSubGroup = node.getAttribute("substitutionGroup") != null;
	var hasRef = node.getAttribute("ref") != null;
	if (hasSubGroup || hasRef){
		// Resolve reference to get the actual definition for this element
		definition = this.xsdManager.execute(this, node, 'buildElement', parentObject);
		if (hasSubGroup) {
			definition = $.extend({}, definition, {'name' : nameParts.localName});
			if (node.parentNode === this.xsd && !hasRef) {
				this.rootDefinitions[nameParts.indexedName] = definition;
			}
		}
	} else {
		// Element has a name, means its a new element
		definition = {
				"name" : nameParts.localName,
				"elements": [],
				"attributes": [],
				"values": [],
				"type": null,
				"ns": this.targetNSIndex,
				"element": true
		};
		
		// If this is a root level element, store it in rootDefinition
		if (parentIsSchema) {
			this.rootDefinitions[nameParts.indexedName] = definition;
		}
		
		// Build or retrieve the type definition
		var type = node.getAttribute("type");
		if (type == null) {
			this.buildType(this.getChildren(node)[0], definition);
		} else {
			definition.type = this.resolveType(type, definition);
			if (definition.type == null) {
				var typeDef = this.xsdManager.execute(this, node, 'buildType', definition);
				// If there was a previously defined type, then store a reference to it
				if (typeDef !== undefined) {
					definition.typeRef = typeDef;
				}
			}
		}
	}
	
	// Add this element as a child of the parent, unless it is abstract or already added
	if (parentObject != null && node.getAttribute("abstract") != "true")
		if (!hasRef || (hasRef && !this.containsChild(parentObject, definition)))
			parentObject.elements.push(definition);
	
	return definition;
}

SchemaProcessor.prototype.buildAttribute = function(node, parentObject) {
	var definition = null;
	var name = node.getAttribute("name");
	var nameParts;
	
	var hasRef = node.getAttribute("ref") != null;
	if (hasRef){
		// Follow reference to get the actual type definition
		definition = this.xsdManager.execute(this, node, 'buildAttribute');
	} else {
		// Actual attribute definition, build new definition
		nameParts = this.extractName(name);
		definition = {
				"name" : nameParts.localName,
				"values": [],
				"ns": this.targetNSIndex,
				"attribute": true
			};
		
		var type = node.getAttribute("type");
		if (type == null) {
			this.buildType(this.getChildren(node)[0], definition);
		} else {
			definition.type = this.resolveType(type, definition);
			if (definition.type == null) {
				var typeDef = this.xsdManager.execute(this, node, 'buildType', definition);
				// If there was a previously defined type, then store a reference to it
				if (typeDef !== undefined) {
					definition.typeRef = typeDef;
				}
			}
		}
	}
	
	// Store the definition to rootDefinitions if it was defined at the root of the schema
	if (node.parentNode === this.xsd && !hasRef) {
		this.rootDefinitions[nameParts.indexedName] = definition;
	}
	
	// Add the definition to its parents attributes array
	if (parentObject != null)
		parentObject.attributes.push(definition);
	
	return definition;
};

// Build a type definition
SchemaProcessor.prototype.buildType = function(node, object) {
	if (node == null)
		return;
	
	var needsMerge = false;
	var extendingObject = object;
	var name = node.getAttribute("name");
	if (name != null){
		var nameParts = this.extractName(name);
		// If this type has already been processed, then apply it
		if (nameParts.indexedName in this.rootDefinitions) {
			this.mergeType(object, this.types[nameParts.indexedName]);
			return;
		}
		// New type, create base
		var type = {
				elements: [],
				attributes: [],
				values: [],
				ns: this.targetNSIndex
			};
		this.rootDefinitions[nameParts.indexedName] = type;
		//this.types[name] = type;
		extendingObject = type;
		needsMerge = true;
	}
	
	// Determine what kind of type this is
	if (node.localName == "complexType") {
		this.buildComplexType(node, extendingObject);
	} else if (node.localName == "simpleType") {
		this.buildSimpleType(node, extendingObject);
	} else if (node.localName == "restriction") {
		this.buildRestriction(node, extendingObject);
	}
	
	// Only need to merge if creating a new named type definition
	if (needsMerge) {
		this.mergeType(object, extendingObject);
	}
};

// Process a complexType tag
SchemaProcessor.prototype.buildComplexType = function(node, object) {
	var self = this;
	if (node.getAttribute("mixed") == "true") {
		object.type = "mixed";
	}
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		if (child.localName == "group") {
			self.xsdManager.execute(this, child, 'buildGroup', object);
		} else if (child.localName == "simpleContent") {
			self.buildSimpleContent(child, object);
		} else if (child.localName == "complexContent") {
			self.buildComplexContent(child, object);
		} else if (child.localName == "choice") {
			self.buildChoice(child, object);
		} else if (child.localName == "attribute") {
			self.buildAttribute(child, object);
		} else if (child.localName == "attributeGroup") {
			self.xsdManager.execute(this, child, 'buildAttributeGroup', object);
		} else if (child.localName == "sequence") {
			self.buildSequence(child, object);
		} else if (child.localName == "all") {
			self.buildAll(child, object);
		}
	}
};

// Process a simpleType tag
SchemaProcessor.prototype.buildSimpleType = function(node, object) {
	var child = this.getChildren(node)[0];
	if (child.localName == "restriction") {
		this.buildRestriction(child, object);
	} else if (child.localName == "list") {
		this.buildList(child, object);
	} else if (child.localName == "union") {
		this.buildUnion(child, object);
	}
};

// Process a list tag
SchemaProcessor.prototype.buildList = function(node, object) {
	var itemType = node.getAttribute('itemType');
	object.type = this.resolveType(itemType, object);
	if (object.type == null) {
		this.xsdManager.execute(this, node, 'buildType', object);
	}
	object.multivalued = true;
};

// Process a union tag
SchemaProcessor.prototype.buildUnion = function(node, object) {
	var memberTypes = node.getAttribute('memberTypes');
	if (memberTypes) {
		memberTypes = memberTypes.split(' ');
		var self = this;
		
		for (var i in memberTypes) {
			var memberType = memberTypes[i];
			var xsdObjSet = self.xsdManager.resolveSchema(self, memberType);
			for (var index in xsdObjSet) {
				var xsdObj = xsdObjSet[index];
				var targetNode = xsdObj.getChildren(null, 'simpleType', memberType);
				if (targetNode && targetNode.length > 0) {
					targetNode = targetNode[0];
					xsdObj.buildType(targetNode, object);
					break;
				}
			}
		}
	}
	
	var self = this;
	var children = this.getChildren(node, 'simpleType');
	for (var i in children)
		self.buildSimpleType(children[i], object);
};

// Process a group tag
SchemaProcessor.prototype.buildGroup = function(node, object) {
	var self = this;
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		if (child.localName == "choice")  {
			self.buildChoice(child, object);
		} else if (child.localName == "all") {
			self.buildAll(child, object);
		} else if (child.localName == "sequence") {
			self.buildSequence(child, object);
		}
	}
};

// Process an all tag
SchemaProcessor.prototype.buildAll = function(node, object) {
	var self = this;
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		if (child.localName == "element") {
			self.buildElement(child, object);
		}
	}
};

// Process a choice tag
SchemaProcessor.prototype.buildChoice = function(node, object) {
	var self = this;
	var choice = {
			"elements": [],
			"minOccurs": node.getAttribute("minOccurs"),
			"maxOccurs": node.getAttribute("maxOccurs")
	};
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		if (child.localName == "element") {
			var element = self.buildElement(child, object);
			choice.elements.push(element.ns + ":" + element.name);
		} else if (child.localName == "group") {
			self.xsdManager.execute(this, child, 'buildGroup', object);
		} else if (child.localName == "choice") {
			self.buildChoice(child, object);
		} else if (child.localName == "sequence") {
			self.buildSequence(child, object);
		} else if (child.localName == "any") {
			self.buildAny(child, object);
		}
	}
	if (!('choices' in object))
		object.choices = [];
	object.choices.push(choice);
};

// Process a sequence tag
SchemaProcessor.prototype.buildSequence = function(node, object) {
	var self = this;
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		if (child.localName == "element") {
			self.buildElement(child, object);
		} else if (child.localName == "group") {
			self.xsdManager.execute(this, child, 'buildGroup', object);
		} else if (child.localName == "choice") {
			self.buildChoice(child, object);
		} else if (child.localName == "sequence") {
			self.buildSequence(child, object);
		} else if (child.localName == "any") {
			self.buildAny(child, object);
		}
	}
};

// Process an any tag
SchemaProcessor.prototype.buildAny = function(node, object) {
	object.any = !(node.getAttribute("minOccurs") == "0" && node.getAttribute("maxOccurs") == "0");
};

// Process a complexContent tag
SchemaProcessor.prototype.buildComplexContent = function(node, object) {
	if (node.getAttribute("mixed") == "true") {
		object.type = "mixed";
	}
	
	var child = this.getChildren(node)[0];
	if (child.localName == "extension") {
		this.buildExtension(child, object);
	} else if (child.localName == "restriction") {
		this.buildRestriction(child, object);
	}
};

// Process a simpleContent tag
SchemaProcessor.prototype.buildSimpleContent = function(node, object) {
	var child = this.getChildren(node)[0];
	if (child.localName == "extension") {
		this.buildExtension(child, object);
	} else if (child.localName == "restriction") {
		this.buildRestriction(child, object);
	}
};

// Process a restriction tag
SchemaProcessor.prototype.buildRestriction = function(node, object) {
	var base = node.getAttribute("base");
	
	object.type = this.resolveType(base, object);
	if (object.type == null) {
		var typeDef = this.xsdManager.execute(this, node, 'buildType', object);
		if (typeDef !== undefined)
			this.mergeType(object, typeDef);
	}
	var self = this;
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		if (child.localName == "enumeration") {
			object.values.push(child.getAttribute("value"));
		} else if (child.localName == "group") {
			self.xsdManager.execute(this, child, 'buildGroup', object);
		} else if (child.localName == "choice") {
			self.buildChoice(child, object);
		} else if (child.localName == "attribute") {
			self.buildAttribute(child, object);
		} else if (child.localName == "attributeGroup") {
			self.xsdManager.execute(this, child, 'buildAttributeGroup', object);
		} else if (child.localName == "sequence") {
			self.buildSequence(child, object);
		} else if (child.localName == "all") {
			self.buildAll(child, object);
		} else if (child.localName == "simpleType") {
			self.buildSimpleType(child, object);
		}
	}
};

// Process an extension tag
SchemaProcessor.prototype.buildExtension = function(node, object) {
	var base = node.getAttribute("base");
	
	object.type = this.resolveType(base, object);
	if (object.type == null) {
		var typeDef = this.xsdManager.execute(this, node, 'buildType', object);
		if (typeDef !== undefined)
			this.mergeType(object, typeDef);
	}
	var self = this;
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		if (child.localName == "attribute") {
			self.buildAttribute(child, object);
		} else if (child.localName == "attributeGroup") {
			self.xsdManager.execute(this, child, 'buildAttributeGroup', object);
		} else if (child.localName == "sequence") {
			self.buildSequence(child, object);
		} else if (child.localName == "all") {
			self.buildAll(child, object);
		} else if (child.localName == "choice") {
			self.buildChoice(child, object);
		} else if (child.localName == "group") {
			self.buildGroup(child, object);
		}
	}
};

// Process an attributeGroup tag
SchemaProcessor.prototype.buildAttributeGroup = function(node, object) {
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		if (child.localName == "attribute") {
			this.buildAttribute(child, object);
		} else if (child.localName == "attributeGroup") {
			this.xsdManager.execute(this, child, 'buildAttributeGroup', object);
		}
	}
};

SchemaProcessor.prototype.stripPrefix = function(name) {
	var index = name.indexOf(":");
	return index == -1? name: name.substring(index + 1);
};

SchemaProcessor.prototype.resolveType = function(type, object) {
	if (object.type != null)
		return object.type;
	if (type.indexOf(":") == -1) {
		if (this.xsPrefix == "")
			return type;
	} else {
		if (type.indexOf(this.xsPrefix) == 0){
			return type.substring(this.xsPrefix.length);
		}
	}
	return null;
};

SchemaProcessor.prototype.mergeType = function(base, type) {
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

//Retrieve all the children of node which belong to the schema namespace.  
//If they are specified, then the results will be filtered to only include children which
//match the given element name and/or have a name attribute of the given value
//filtered to
SchemaProcessor.prototype.getChildren = function(node, childName, nameAttribute) {
	var children = [];
	if (!node)
		node = this.xsd;
	var childNameSpecified = childName !== undefined;
	var attributeSpecified = nameAttribute !== undefined;
	var childNodes = node.childNodes;
	for (var index in childNodes) {
		var child = childNodes[index];
		if (child.nodeType == 1 && child.namespaceURI == this.xsdManager.xsNS && 
				((childNameSpecified && child.localName == childName) || (!childNameSpecified && child.localName != 'annotation')) &&
				(!attributeSpecified || child.getAttribute('name') == nameAttribute))
			children.push(child);
	}
	return children;
}

//Namespace aware check to see if a definition already contains parent child element
SchemaProcessor.prototype.containsChild = function(object, child) {
	if (object.elements) {
		for (var index in object.elements) {
			if (object.elements[index].name == child.name
					&& object.elements[index].ns == child.ns)
				return true;
		}
	}
	return false;
};

SchemaProcessor.prototype.extractName = function(name) {
	if (!name)
		return null;
	var result = {};
	var index = name.indexOf(':');
	if (index == -1) {
		result['localName'] = name;
		result['prefix'] = "";
	} else {
		result['localName'] = name.substring(index + 1);
		result['prefix'] = name.substring(0, index);
	}
	result['namespace'] = this.xsdManager.getNamespaceIndex(this.localNamespaces[result.prefix]);
	result['indexedName'] = result.namespace + ":" + result.localName;
	return result;
};

//Register a namespace, and optionally its prefix, to the schema
SchemaProcessor.prototype.registerNamespace = function(namespaceUri, prefix) {
	var namespaceIndex = this.xsdManager.registerNamespace(namespaceUri);

	if (prefix !== undefined)
		this.localNamespaces[prefix] = namespaceUri;
	
	return namespaceIndex;
};

SchemaProcessor.prototype.getLocalNamespacePrefix = function(namespaceUri) {
	for (var prefix in this.localNamespaces) {
		if (this.localNamespaces[prefix] == namespaceUri)
			return prefix;
	}
	return null;
};
; return Xsd2Json;}.call();