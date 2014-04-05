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
function SchemaProcessor(xsdDocument, xsdManager, schemaUrl, parentNSIndex) {
	
	this.xsd = xsdDocument;
	this.xsdManager = xsdManager;
	this.schemaUrl = schemaUrl;
	this.schemaPath = this.schemaUrl.substring(0, this.schemaUrl.lastIndexOf("/") + 1);
	
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

SchemaProcessor.prototype.build = function(node, startingDef, fnName) {
	var name = node.getAttribute("name");
	var definition = startingDef;
	
	if (name && node.parentNode == this.xsd) {
		var nameParts = schema.extractName(name);
		if (nameParts.indexedName in this.rootDefinitions){
			// Use the cached definition
			return this.rootDefinitions[nameParts.indexedName];
		} else {
			// New root definition
			definition = {
				name : nameParts.localName,
				values : [],
				type : null,
				ns: this.targetNSIndex
			};
			
			if (node.localName == "attribute") {
				definition.attribute = true;
			} else {
				if (node.localName == "element")
					definition.element = true;
				definition.attributes = [];
				definition.elements = [];
			}
			
			this.rootDefinitions[nameParts.indexedName] = definition;
		}
	}
	
	if (!fnName) {
		fnName = "build_" + node.localName;
	}
	
	return this[fnName](node, definition);
};

SchemaProcessor.prototype.resolveBuild = function(node, definition) {
	this.xsdManager.resolve(node, definition, "build");
};

SchemaProcessor.prototype.addElement = function(node, definition, parentDef) {
	
	if (!parentDef.schema) {
		// Store min/max occurs on the the elements parent, as they only apply to this particular relationship
		// Root level elements can't have min/max occurs attributes
		var minOccurs = node.getAttribute("minOccurs");
		var maxOccurs = node.getAttribute("maxOccurs");
		if (parentObject && (minOccurs || maxOccurs)) {
			var nameOrRefParts = nameParts? nameParts : this.extractName(node.getAttribute("ref"));
			if (!("occurs" in parentObject))
				parentDef.occurs = {};
			parentDef.occurs[nameOrRefParts.indexedName] = {
					'min' : minOccurs,
					'max' : maxOccurs
			};
		}
	}
	
	// Add this element as a child of the parent, unless it is abstract or already added
	if (parentDef != null && node.getAttribute("abstract") != "true"
			&& !this.containsChild(parentDef, definition))
		parentDef.elements.push(definition);
};

SchemaProcessor.prototype.addAttribute = function(node, definition, parentDef) {
	// Add the definition to its parents attributes array
	if (parentDef != null)
		parentDef.attributes.push(definition);
};

// Build the schema tag
SchemaProcessor.prototype.build_schema = function(node) {
	var object = {
		"elements": [],
		"ns": this.targetNSIndex,
		"schema": true
	};
	var self = this;
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		if (child.localName == 'element') {
			var element = this.build(child, object);
			this.addElement(child, element, object);
		} else if (child.localName == 'simpleType' || 
				child.localName == 'attribute' || child.localName == 'complexType' ||
				child.localName == 'group' || child.localName == 'attributeGroup') {
			this.build(child, object);
		}
	}
	return object;
};

// Build an element definition
// node - element schema node
// parentObject - definition of the parent this element will be added to
SchemaProcessor.prototype.build_element = function(node, definition, parentDef) {
	var definition = null;
	var name = node.getAttribute("name");
	var nameParts = this.extractName(name);
	
	var hasSubGroup = node.getAttribute("substitutionGroup") != null;
	var hasRef = node.getAttribute("ref") != null;
	if (hasSubGroup || hasRef){
		// Resolve reference to get the actual definition for this element
		definition = this.resolveBuild(node);
		//definition = this.xsdManager.execute(this, node, 'buildElement', parentObject);
		// Substitution group not yet entirely implement
//		if (hasSubGroup) {
//			definition = $.extend({}, definition, {'name' : nameParts.localName});
//			if (node.parentNode === this.xsd && !hasRef) {
//				this.rootDefinitions[nameParts.indexedName] = definition;
//			}
//		}
	} else {
		
		// Build or retrieve the type definition
		var type = node.getAttribute("type");
		if (type == null) {
			this.build_type(this.getChildren(node)[0], definition);
		} else {
			definition.type = this.resolveType(type, definition);
			if (definition.type == null) {
				var typeDef = this.resolveBuild(node, definition);
				// If there was a previously defined type, then store a reference to it
				if (typeDef !== undefined) {
					definition.typeRef = typeDef;
				}
			}
		}
	}
	
	return definition;
}

SchemaProcessor.prototype.build_attribute = function(node, definition) {
	var name = node.getAttribute("name");
	var nameParts;
	
	var hasRef = node.getAttribute("ref") != null;
	if (hasRef){
		// Follow reference to get the actual type definition and merge in
		$.extend(definition, this.resolveBuild(node));
	} else {
		
		var type = node.getAttribute("type");
		if (type == null) {
			this.build_type(this.getChildren(node)[0], definition);
		} else {
			definition.type = this.resolveType(type, definition);
			if (definition.type == null) {
				var typeDef = this.resolveBuild(node, definition);
				// If there was a previously defined type, then store a reference to it
				if (typeDef !== undefined) {
					definition.typeRef = typeDef;
				}
			}
		}
	}
	
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