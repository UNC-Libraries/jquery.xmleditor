/**
 * Stores a traversible tree of element types
 * @param rootElement
 */
function SchemaTree(rootElement) {
	this.nameToDef = {};
	this.rootElement = rootElement;
	this.namespaces = new NamespaceList();
}

SchemaTree.prototype.build = function(elementName, elementDef, parentDef) {
	// Default to the root element if no element is given.
	if (arguments.length == 0) {
		elementName = this.rootElement.name;
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
	
	// Collect the list of prefix/namespace pairs in use in this schema
	var namespace = elementDef.namespace;
	if (!this.namespaces.containsURI(namespace)) {
		var nameParts = elementDef.name.split(":");
		var prefix = (nameParts.length == 1)? "" : nameParts[0];
		this.namespaces.addNamespace(namespace, prefix);
	}
	
	// Add this definition to the list matching its element name, in case of overlapping names
	var definitionList = this.nameToDef[elementName];
	if (definitionList == null) {
		this.nameToDef[elementName] = [elementDef];
	} else {
		this.nameToDef[elementName].push(elementDef);
	}
	
	// Call build on all the child elements of this element.
	var self = this;
	$.each(elementDef.elements, function() {
		self.build(this.name, this, elementDef);
	});
};



/**
 * Retrieves the schema definition for the provided element, attempting to 
 * disambiguate when the name is not unique.
 */
SchemaTree.prototype.getElementDefinition = function(elementNode) {
	var prefixedName = this.namespaces.getNamespacePrefix(elementNode.namespaceURI) + elementNode.localName;
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
			if (parentDef.localName == parentNode.localName && parentDef.namespace == parentNode.namespaceURI) {
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