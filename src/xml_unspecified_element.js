/**
 * Stores data related to a single xml element as it is represented in both the base XML 
 * document and GUI
 */
function XMLUnspecifiedElement(xmlNode, editor) {
	var unspecifiedType = {
		element : true,
		type : "mixed"
	};

	AbstractXMLObject.call(this, unspecifiedType, editor);
	// jquery object reference to the xml node represented by this object in the active xml document
	this.xmlNode = $(xmlNode);
	this.isRootElement = this.xmlNode[0].parentNode === this.xmlNode[0].ownerDocument;
	// Flag indicating if this element is a child of the root node
	this.isTopLevel = this.xmlNode[0].parentNode.parentNode === this.xmlNode[0].ownerDocument;
	this.allowChildren = true;
	// Flag indicating if any attributes can be added to this element
	this.allowAttributes = true;
	// Should this element allow text nodes to be added
	this.allowText = true;
	// dom element header for this element
	this.elementHeader = null;
	// dom element which contains the display of child nodes
	this.nodeContainer = null;

	this.tagName = "";
}

XMLUnspecifiedElement.prototype.constructor = XMLUnspecifiedElement;
XMLUnspecifiedElement.prototype = Object.create( XMLElement.prototype );

XMLUnspecifiedElement.prototype.render = function(parentElement, recursive, relativeToXMLElement, prepend) {
	this.parentElement = parentElement;
	this.domNodeID = this.guiEditor.nextIndex();
	
	// Create the element and add it to the container
	this.domNode = document.createElement('div');
	var $domNode = $(this.domNode);
	this.domNode.id = this.domNodeID;
	this.domNode.className = 'xml_node ' + xmlElementClass;
	if (this.isTopLevel)
		this.domNode.className += ' ' + topLevelContainerClass;
	if (this.isRootElement)
		this.domNode.className += ' xml_root_element';
	if (this.parentElement) {
		if (relativeToXMLElement) {
			if (prepend)
				$domNode.insertBefore(relativeToXMLElement.domNode);
			else
				$domNode.insertAfter(relativeToXMLElement.domNode);
		} else {
			if (prepend)
				this.parentElement.nodeContainer.prepend(this.domNode);
			else
				this.parentElement.nodeContainer[0].appendChild(this.domNode);
		}
	}
	
	// Begin building contents
	this.elementHeader = document.createElement('ul');
	this.elementHeader.className = 'element_header';
	this.domNode.appendChild(this.elementHeader);
	var elementNameContainer = document.createElement('li');
	elementNameContainer.className = 'element_name';
	this.elementHeader.appendChild(elementNameContainer);

	this.elementName = this.xmlNode[0].tagName;
	
	// set up element title and entry field if appropriate
	var titleElement = document.createElement('span');
	titleElement.appendChild(document.createTextNode(this.elementName));
	elementNameContainer.appendChild(titleElement);
	
	// Switch gui element over to a jquery object
	this.domNode = $domNode;
	this.domNode.data("xmlObject", this);

	// Add the subsections for the elements content next.
	this.addContentContainers(recursive);

	// Action buttons
	if (!this.isRootElement)
		this.elementHeader.appendChild(this.addTopActions(this.domNodeID));
	
	this.initializeGUI();
	this.updated({action : 'render'});
	
	return this.domNode;
};

XMLUnspecifiedElement.prototype.addContentContainers = function (recursive) {
	var attributesArray = this.objectType.attributes;
	var elementsArray = this.objectType.elements;
	
	var placeholder = document.createElement('div');
	placeholder.className = 'placeholder';

	placeholder.appendChild(document.createTextNode('Use the menu to add contents.'));

	this.placeholder = $(placeholder);
	this.domNode.append(this.placeholder);
	
	this.addAttributeContainer();

	this.addNodeContainer(recursive);
};

XMLUnspecifiedElement.prototype.updateChildrenCount = function(childElement, delta) {
	this.nodeCount += delta;
};