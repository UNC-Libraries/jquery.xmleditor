/**
 * Stores a traversible tree of element types
 * @param rootElement
 */
function SchemaTree(rootElement) {
	this.nameToDef = {};
	this.rootElement = rootElement;
	this.namespaceIndexes = this.rootElement.namespaces;
	this.namespaces = new NamespaceList();
	for (var index in this.namespaceIndexes) {
		var def = this.namespaceIndexes[index];
		this.namespaces.addNamespace(def.uri, def.prefix);
	}
}

SchemaTree.prototype.build = function(elementName, elementDef, parentDef) {
	// Default to the root element if no element is given.
	if (arguments.length == 0) {
		elementName = this.rootElement.ns + ":" + this.rootElement.name;
		elementDef = this.rootElement;
		parentDef = null;
	}
	
	if ("parents" in elementDef) {
		// Definition already has a parent, so this is a circular definition
		elementDef.parents.push(parentDef);
		return;
	} else {
		elementDef["parents"] = [parentDef];
	}
	
	var namespaceDefinition = this.namespaceIndexes[elementDef.ns];
	//Resolve namespace index into actual namespace uri
	elementDef.namespace = namespaceDefinition.uri;
	if (!elementDef.schema) {
		elementDef.localName = elementDef.name;
		elementDef.name = namespaceDefinition.prefix? namespaceDefinition.prefix + ":" : "" + elementDef.localName;
	}
	
	// Add this definition to the list matching its element name, in case of overlapping names
	var definitionList = this.nameToDef[elementName];
	if (definitionList == null) {
		this.nameToDef[elementName] = [elementDef];
	} else {
		this.nameToDef[elementName].push(elementDef);
	}
	
	var self = this;
	if (elementDef.attributes)
		$.each(elementDef.attributes, function() {
			if (this.localName)
				return true;
			this.localName = this.name;
			var namespaceDefinition = self.namespaceIndexes[this.ns];
			this.namespace = namespaceDefinition.uri;
			this.name = (namespaceDefinition.prefix? namespaceDefinition.prefix + ":" : "") + this.localName;
		});
	// Call build on all the child elements of this element.
	$.each(elementDef.elements, function() {
		self.build(this.ns + ":" + this.name, this, elementDef);
	});
};



/**
 * Retrieves the schema definition for the provided element, attempting to 
 * disambiguate when the name is not unique.
 */
SchemaTree.prototype.getElementDefinition = function(elementNode) {
	var namespaceIndex = 0;
	$.each(this.namespaceIndexes, function(){
		if (this.uri == elementNode.namespaceURI)
			return false;
		namespaceIndex++;
	});
	var prefixedName = namespaceIndex + ":" + localName(elementNode);
	var defList = this.nameToDef[prefixedName];
	if (defList == null)
		return null;
	if (defList.length == 1)
		return defList[0];
	
	for (index in defList) {
		if (this.pathMatches(elementNode, defList[index]))
			return defList[index];
	}
};

SchemaTree.prototype.pathMatches = function(elementNode, definition) {
	var isRootNode = elementNode.parentNode instanceof Document;
	var parentNode = elementNode.parentNode;
	for (index in definition.parents) {
		var parentDef = definition.parents[index];
		if (isRootNode) {
			// If this is a root node and the definition allows it, then we have a match
			if (definition.parents[index] == null || definition.parents[index].schema)
				return true;
		} else {
			if (localName(parentDef) == localName(parentNode) && parentDef.namespace == parentNode.namespaceURI) {
				// Parent definitions matched, so continue the walk
				var answer = this.pathMatches(parentNode, parentDef);
				// If this particular parent definition matched all the way, then return true.
				if (answer)
					return true;
			}
		}
	}
	return false;
};