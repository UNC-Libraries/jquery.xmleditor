/**
 * Stores data representing a single attribute for an element
 */
function XMLAttribute(objectType, xmlElement, editor) {
	AbstractXMLObject.call(this, editor, objectType);
	// the XMLElement object which this attribute belongs to.
	this.xmlElement = xmlElement;
	this.attributeID = null;
	this.attributeInput = null;
	this.attributeContainer = null;
	// The menu button associated with this attribute.  Used for reenabling attribute in menu on remove
	// TODO replace this with a more general solution
	this.addButton = null;

	var prefix;
	this.attributeName = objectType.localName;
	// Determine whether the attribute name should include a namespace prefix
	if (this.xmlElement.objectType.namespace != this.objectType.namespace) {
		prefix = this.editor.xmlState.namespaces.getNamespacePrefix(this.objectType.namespace);
		this.attributeName = prefix + this.attributeName;
	}
}

XMLAttribute.prototype.constructor = XMLAttribute;
XMLAttribute.prototype = Object.create( AbstractXMLObject.prototype );

XMLAttribute.prototype.getDomNode = function () {
	return this.attributeContainer;
};

// Render the gui representation of this attribute
XMLAttribute.prototype.render = function (){
	this.attributeID = this.xmlElement.domNodeID + "_" + this.objectType.ns + "_" + this.objectType.localName;
	
	this.attributeContainer = $("<div/>").attr({
		'id' : this.attributeID + "_cont",
		'class' : attributeContainerClass
	}).data('xmlAttribute', this).appendTo(this.xmlElement.getAttributeContainer());
	
	var self = this;
	var removeButton = document.createElement('a');
	removeButton.appendChild(document.createTextNode('(x) '));
	this.attributeContainer[0].appendChild(removeButton);
	
	var label = document.createElement('label');
	var prefix = this.editor.xmlState.namespaces.getNamespacePrefix(this.objectType.namespace);
	label.appendChild(document.createTextNode(prefix + this.objectType.localName));
	this.attributeContainer[0].appendChild(label);
	
	var attributeValue = this.xmlElement.xmlNode.attr(this.attributeName);
	if (attributeValue == '' && this.objectType.defaultValue != null) {
		attributeValue = this.objectType.defaultValue;
	}
	
	this.attributeInput = this.createElementInput(this.attributeID.replace(":", "-"), attributeValue, this.attributeContainer[0]);
	this.attributeInput.data('xmlAttribute', this);
	
	return this.attributeInput;
};

XMLAttribute.prototype.remove = function() {
	// Tell the button associated with this attribute that it was removed.  Replace this
	if ($("#" + this.attributeID).length > 0) {
		if (this.addButton != null){
			this.addButton.removeClass("disabled");
		}
	}
	this.xmlElement.removeAttribute(this.objectType);
	this.attributeContainer.remove();
};

// Synchronize this attributes value from the gui input back to the xml document
XMLAttribute.prototype.syncValue = function() {
	this.xmlElement.xmlNode.attr(this.attributeName, this.attributeInput.val());
};

// Change the attribute's value in the xml document to value
XMLAttribute.prototype.changeValue = function(value) {
	this.xmlElement.xmlNode.attr(this.attributeName, value);
};

XMLAttribute.prototype.select = function() {
	this.editor.guiEditor.selectElement(self.xmlElement);
	this.attributeContainer.addClass('selected');
};

XMLAttribute.prototype.deselect = function() {
	this.attributeContainer.removeClass('selected');
};
