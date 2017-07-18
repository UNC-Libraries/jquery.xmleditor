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
	
	// Local namespace prefix registry
	this.localNamespaces = $.extend({}, this.xsdManager.globalNamespaces);

	this.extractNamespaces();

	if (parentNSIndex !== undefined) {
		this.targetNSIndex = parentNSIndex;
		this.targetNS = this.xsdManager.getNamespaceUri(parentNSIndex);
	} else {
		this.targetNS = this.xsd.getAttribute('targetNamespace');
		this.targetNSIndex = this.xsdManager.registerNamespace(this.targetNS);
	}
	
	// Register the correct default namespace if none was specified, see:
	// * https://www.w3.org/TR/xmlschema11-1/#src-include
	// * https://www.w3.org/TR/xmlschema11-1/#sec-src-resolve
	if (!('' in this.localNamespaces)) {
		if (this.xsd.getAttribute('targetNamespace') === null) {
			this.localNamespaces[''] = this.targetNS;
		} else {
			this.localNamespaces[''] = this.xsdManager.xsNS;
		}
	}

	// Root definition for this schema, either an element or a schema object
	this.root = null;
};

// Process the schema file to extract its structure into javascript objects
SchemaProcessor.prototype.processSchema = function() {
	
	// Begin constructing the element tree, starting from the schema element
	this.root = this.build_schema(this.xsd);
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
		}
	}
};

SchemaProcessor.prototype.createDefinition = function(node, name) {
	if (!name) {
		name = node.getAttribute("name");
	}
		
	// New root definition
	var definition = {
		values : [],
		type : null,
		ns: this.targetNSIndex,
		np : true
	};
	
	if (name)
		definition.name = name;
	
	if (node.localName == "attribute") {
		definition.attribute = true;
	} else {
		if (node.localName == "element")
			definition.element = true;
		definition.attributes = [];
		definition.elements = [];
	}
	
	return definition;
};

SchemaProcessor.prototype.addElement = function(node, definition, parentDef) {
	
	if (!parentDef.schema) {
		// Store min/max occurs on the the elements parent, as they only apply to this particular relationship
		// Root level elements can't have min/max occurs attributes
		var minOccurs = node.getAttribute("minOccurs");
		var maxOccurs = node.getAttribute("maxOccurs");
		if (parentDef && (minOccurs || maxOccurs)) {
			var name = node.getAttribute('name');
			var indexedNameOrRef = name ? this.indexedDefinitionName(name) : this.extractName(node.getAttribute('ref')).indexedName;
			if (!("occurs" in parentDef))
				parentDef.occurs = {};
			parentDef.occurs[indexedNameOrRef] = {
					'min' : minOccurs,
					'max' : maxOccurs
			};
		}
	}
	
	// Add this element as a child of the parent, unless it is abstract or already added
	if (parentDef != null && node.getAttribute("abstract") != "true"
			&& !this.containsChild(parentDef, definition))
		parentDef.elements.push(definition);
	
	return definition;
};

SchemaProcessor.prototype.addAttribute = function(node, definition, parentDef) {
	// Add the definition to its parents attributes array
	if (parentDef != null)
		parentDef.attributes.push(definition);
};

SchemaProcessor.prototype.addReference = function(definition, refName) {
	var nameParts = this.extractName(refName);
	definition.ref = nameParts.indexedName;
};

SchemaProcessor.prototype.addTypeReference = function(definition, refName, mergeMode) {
	var nameParts = this.extractName(refName);
	if (!definition.typeRef) {
		definition.typeRef = [];
	}
	
	definition.typeRef.push({indexedName: nameParts.indexedName, mergeMode: mergeMode});
};

// Build the schema tag
SchemaProcessor.prototype.build_schema = function(node) {
	var definition = {
		elements : [],
		ns : this.targetNSIndex,
		schema : true,
		np : true
	};
	var self = this;
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];

		if (child.localName == 'element') {
			var element = this.buildTopLevel(child, definition);
			this.addElement(child, element, definition);
		} else if (child.localName == 'simpleType' || 
				child.localName == 'attribute' || child.localName == 'complexType' ||
				child.localName == 'group' || child.localName == 'attributeGroup') {
			this.buildTopLevel(child, definition);
		}
	}
	return definition;
};

SchemaProcessor.prototype.buildTopLevel = function(node) {
	var name = node.getAttribute("name");
	// Root level definitions must have a name attribute
	if (!name)
		return;
	
	// New root definition
	var definition = this.createDefinition(node, name);
	this.rootDefinitions[this.indexedDefinitionName(name)] = definition;
	
	return this.build(node, definition);
};

SchemaProcessor.prototype.build = function(node, definition, parentDef) {
	return this["build_" + node.localName](node, definition, parentDef);
};

// Build an element definition
// node - element schema node
// parentdefinition - definition of the parent this element will be added to
SchemaProcessor.prototype.build_element = function(node, definition, parentDef) {
	
	var ref = node.getAttribute("ref");
	var subGroup = node.getAttribute("substitutionGroup");
	if (ref) {
		this.addReference(definition, ref);
	} else if (subGroup) {
		this.addTypeReference(definition, subGroup, 'extension');
	} else {
		// Build or retrieve the type definition
		var type = node.getAttribute("type");
		if (type == null) {
			var child = this.getChildren(node)[0];
			if (child) {
				this.build(child, definition);
			} else {
				definition.type = 'anyType';
			}
		} else {
			// Check to see if it is a built in type
			definition.type = this.getBuiltInType(type, definition);
			if (definition.type == null) {
				// Was not built in, make a reference to resolve later
				this.addTypeReference(definition, type, 'extension');
			}
		}
	}
	
	return definition;
}

SchemaProcessor.prototype.build_attribute = function(node, definition) {
	var ref = node.getAttribute("ref");
	if (ref) {
		this.addReference(definition, ref);
	} else {
		// Build or retrieve the type definition
		var type = node.getAttribute("type");
		if (type == null) {
			var child = this.getChildren(node)[0];
			if (child)
				this.build(this.getChildren(node)[0], definition);
			else // Fall back to string type if nothing else available
				definition.type = "string";
		} else {
			// Check to see if it is a built in type
			definition.type = this.getBuiltInType(type, definition);
			if (definition.type == null) {
				// Was not built in, make a reference to resolve later
				this.addTypeReference(definition, type, 'extension');
			}
		}
	}
	
	return definition;
};

// Process a complexType tag
SchemaProcessor.prototype.build_complexType = function(node, definition, parentDef) {
	if (node.getAttribute("mixed") == "true") {
		definition.type = "mixed";
	}
	
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		switch (child.localName) {
		case "group" : case "simpleContent" : case "complexContent" : case "choice" : 
		case "attributeGroup" : case "sequence" : case "all" : case "anyAttribute" :
			this.build(child, definition);
			break;
		case "attribute" :
			this.addAttribute(child, this.build_attribute(child, 
					this.createDefinition(child)), definition);
		}
	}
};

// Process a simpleType tag
SchemaProcessor.prototype.build_simpleType = function(node, definition) {
	var child = this.getChildren(node)[0];
	switch (child.localName) {
	case "restriction" : case "list" : case "union" :
		this.build(child, definition);
	}
};

// Process a list tag, which allows for a single tag with multiple values
SchemaProcessor.prototype.build_list = function(node, definition) {
	// For the moment, lists will just be treated as free text fields
	definition.type = "string";
	definition.multivalued = true;
};

// Process a union tag
SchemaProcessor.prototype.build_union = function(node, definition) {
	var memberTypes = node.getAttribute('memberTypes');
	if (memberTypes) {
		memberTypes = memberTypes.split(' ');
		
		for (var i in memberTypes) {
			var memberType = memberTypes[i];
			
			definition.type = this.getBuiltInType(memberType, definition);
			if (definition.type == null) {
				this.addTypeReference(definition, memberType, 'extension');
			}
		}
	}
	
	var self = this;
	var children = this.getChildren(node, 'simpleType');
	for (var i in children)
		self.build_simpleType(children[i], definition);
};

// Process a group tag
SchemaProcessor.prototype.build_group = function(node, definition) {
	var ref = node.getAttribute("ref");
	if (ref){
		this.addTypeReference(definition, ref, 'extension');
		return definition;
	}
	var self = this;
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		switch (child.localName) {
		case "choice" : case "all" : case "sequence" :
			this.build(child, definition);
		}
	}
};

// Process an all tag
SchemaProcessor.prototype.build_all = function(node, definition) {
	var self = this;
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		if (child.localName == "element") {
			this.addElement(child, this.build_element(child, 
					this.createDefinition(child)), definition);
		}
	}
};

// Process a choice tag
SchemaProcessor.prototype.build_choice = function(node, definition) {
	var self = this;
	var max = node.getAttribute("maxOccurs");
	var choice = {
			"elements": [],
			"minOccurs": node.getAttribute("minOccurs"),
			"maxOccurs": (max == null || (isNaN(max) && "unbounded" != max) || max < 0)? 1 : max
	};
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		switch (child.localName) {
		case "choice" : case "group" : case "sequence" : case "any" :
			this.build(child, definition);
			break;
		case "element" :
			var element = this.addElement(child, this.build_element(child, 
					this.createDefinition(child)), definition);
			if (element.name)
				choice.elements.push(element.ns + ":" + element.name);
			else
				choice.elements.push(element.ref);
		}
	}
	if (!('choices' in definition))
		definition.choices = [];
	definition.choices.push(choice);
};

// Process a sequence tag
SchemaProcessor.prototype.build_sequence = function(node, definition) {
	var self = this;
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		switch (child.localName) {
		case "choice" : case "group" : case "sequence" : case "any" :
			this.build(child, definition);
			break;
		case "element" :
			var element = this.addElement(child, this.build_element(child, 
					this.createDefinition(child)), definition);
		}
	}
};

// Process an any tag
SchemaProcessor.prototype.build_any = function(node, definition) {
	definition.any = !(node.getAttribute("minOccurs") == "0" && node.getAttribute("maxOccurs") == "0");
};

SchemaProcessor.prototype.build_anyAttribute = function(node, definition) {
	definition.anyAttribute = true;
};

// Process a complexContent tag
SchemaProcessor.prototype.build_complexContent = function(node, definition) {
	if (node.getAttribute("mixed") == "true") {
		definition.type = "mixed";
	}
	
	var child = this.getChildren(node)[0];
	switch (child.localName) {
	case "extension" : case "restriction" :
		this.build(child, definition);
	}
};

// Process a simpleContent tag
SchemaProcessor.prototype.build_simpleContent = function(node, definition) {
	var child = this.getChildren(node)[0];
	switch (child.localName) {
	case "extension" : case "restriction" :
		this.build(child, definition);
	}
};

// Process a restriction tag
SchemaProcessor.prototype.build_restriction = function(node, definition) {
	var base = node.getAttribute("base");
	
	definition.type = this.getBuiltInType(base, definition);
	if (definition.type == null) {
		this.addTypeReference(definition, base, 'restriction');
	}
	
	var self = this;
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		switch (child.localName) {
		case "group" : case "simpleType" : case "choice" : 
		case "attributeGroup" : case "sequence" : case "all" : case "anyAttribute":
			this.build(child, definition);
			break;
		case "attribute" :
			this.addAttribute(child, this.build_attribute(child, 
					this.createDefinition(child)), definition);
			break;
		case "enumeration" :
			definition.values.push(child.getAttribute("value"));
		}
	}
};

// Process an extension tag
SchemaProcessor.prototype.build_extension = function(node, definition) {
	var base = node.getAttribute("base");
	
	definition.type = this.getBuiltInType(base, definition);
	if (definition.type == null) {
		this.addTypeReference(definition, base, 'extension');
	}
	
	var self = this;
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		switch (child.localName) {
		case "group" : case "choice" : case "attributeGroup" : 
		case "sequence" : case "all" : case "anyAttribute":
			this.build(child, definition);
			break;
		case "attribute" :
			this.addAttribute(child, this.build_attribute(child, 
					this.createDefinition(child)), definition);
		}
	}
};

// Process an attributeGroup tag
SchemaProcessor.prototype.build_attributeGroup = function(node, definition) {
	var ref = node.getAttribute("ref");
	if (ref){
		this.addTypeReference(definition, ref, 'extension');
		return definition;
	}
	
	var children = this.getChildren(node);
	for (var i in children) {
		var child = children[i];
		switch (child.localName) {
		case "attributeGroup" : case "anyAttribute" :
			this.build(child, definition);
			break;
		case "attribute" :
			this.addAttribute(child, this.build_attribute(child, 
					this.createDefinition(child)), definition);
		}
	}
};

SchemaProcessor.prototype.getBuiltInType = function(type, definition) {
	if (definition.type != null)
		return definition.type;
	var nameParts = this.extractName(type);
	if (nameParts.namespaceUri === this.xsdManager.xsNS) {
		return nameParts.localName;
	}
	return null;
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
SchemaProcessor.prototype.containsChild = function(definition, child) {
	if (definition.elements) {
		var childName = child.ref || child.ns + ":" + child.name;
		for (var index in definition.elements) {
			var element = definition.elements[index];
			var existingName = element.ref || element.ns + ":" + element.name;
			
			if (childName == existingName)
				return true;
		}
	}
	return false;
};

SchemaProcessor.prototype.indexedDefinitionName = function(name) {
	return this.targetNSIndex + ':' + name;
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
	var namespaceUri = this.localNamespaces[result.prefix];
	result['namespaceUri'] = namespaceUri;
	result['namespace'] = this.xsdManager.getNamespaceIndex(namespaceUri);
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