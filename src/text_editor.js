/**
 * Editor object for doing text editing of the XML document using the cloud9 editor
 */
function TextEditor(editor) {
	this.editor = editor;
	this.aceEditor = null;
	this.state = 0;
	this.xmlEditorDiv = null;
	this.xmlContent = null;
	this.selectedTagRange = null;
	this.resetSelectedTagRange();
	this.active = false;
	this.tagRegex = /<(([a-zA-Z0-9\-]+:)?([a-zA-Z0-9\-]+))( |\/|>|$)/;
}

TextEditor.prototype.resetSelectedTagRange = function() {
	this.selectedTagRange = {'row': 0, 'startColumn': 0, 'endColumn': 0};
	return this;
};

TextEditor.prototype.initialize = function(parentContainer) {
	this.xmlContent = $("<div/>").attr({'id' : textContentClass + this.editor.instanceNumber, 'class' : textContentClass}).appendTo(parentContainer);
	this.xmlEditorDiv = $("<div/>").attr('id', 'text_editor').appendTo(this.xmlContent);
	this.aceEditor = ace.edit("text_editor");
	this.aceEditor.setTheme("ace/theme/textmate");
	this.aceEditor.getSession().setMode("ace/mode/xml");
	this.aceEditor.setShowPrintMargin(false);
	this.aceEditor.getSession().setUseSoftTabs(true);
	
	var self = this;
	this.aceEditor.getSession().on('change', function(){
		// if the editor is backed by a text area, then keep the value up to date
		if (self.editor.isTextAreaEditor)
			self.editor.setTextArea(self.aceEditor.getSession().getValue());
		// Inform the document if there are changes which need to be synched
		if (!self.editor.xmlState.changesNotSynced() && self.isPopulated()){
			self.editor.xmlState.unsyncedChangeEvent();
			self.setModified();
		}
	});
	this.aceEditor.getSession().selection.on('changeCursor', function(){
		self.selectTagAtCursor();
	});
	
	this.setInitialized();
	return this;
};

TextEditor.prototype.activate = function() {
	this.active = true;
	
	if (!this.isInitialized()){
		this.initialize(this.editor.xmlTabContainer);
	}
	this.xmlContent.show();
	this.refreshDisplay();
	
	this.resize();
	return this;
};

TextEditor.prototype.deactivate = function() {
	this.xmlContent.hide();
	this.active = false;
	this.editor.modifyMenu.clearContextualMenus();
	if (this.isInitialized()) {
		this.setInitialized();
	}
	return this;
};

TextEditor.prototype.isInitialized = function() {
	return this.state > 0;
};

TextEditor.prototype.isPopulated = function() {
	return this.state > 1;
};

TextEditor.prototype.isModified = function() {
	return this.state > 2;
};

TextEditor.prototype.setInitialized = function() {
	this.state = 1;
	return this;
};

TextEditor.prototype.setPopulated = function() {
	this.state = 2;
	return this;
};

TextEditor.prototype.setModified = function() {
	this.state = 3;
	return this;
};

// Determine if the position given is inside of the boundries of the currently selected tag
TextEditor.prototype.inSelectedTag = function(row, startColumn, endColumn) {
	return !this.editor.xmlState.changesNotSynced() && row == this.selectedTagRange.row 
		&& startColumn == this.selectedTagRange.startColumn 
		&& endColumn == this.selectedTagRange.endColumn;
};

// Reload the contents of the editor from the XML document and reset the editor
TextEditor.prototype.reload = function() {
	this.setInitialized();
	this.selectedTagRange = {'row': 0, 'startColumn': 0, 'endColumn': 0};
	var cursorPosition = this.aceEditor.selection.getCursor();
	this.aceEditor.getSession().setValue(this.editor.xml2Str(this.editor.xmlState.xml));
	this.setPopulated();
	this.aceEditor.focus();
	this.aceEditor.selection.moveCursorToPosition(cursorPosition);
	return this;
};

// Refresh the display of this editor
TextEditor.prototype.refreshDisplay = function() {
	this.editor.guiEditor.rootElement.xmlNode = this.editor.xmlState.xml.children().first();
	var markers = this.aceEditor.session.getMarkers();
	var self = this;
	$.each(markers, function(index) {
		self.aceEditor.session.removeMarker(index);
	});
	
	this.setInitialized();
	var xmlString = this.editor.xml2Str(this.editor.xmlState.xml);
	try {
		this.aceEditor.getSession().setValue(xmlString);
	} catch (e) {
		alert(e);
	}
	
	this.aceEditor.clearSelection();
	this.setPopulated();
	
	this.selectTagAtCursor();
	return this;
};

// Adjust the size of the editor to reflect its environment
TextEditor.prototype.resize = function() {
	var xmlEditorHeight = ($(window).height() - this.xmlEditorDiv.offset().top);
	this.xmlContent.css({'height': xmlEditorHeight + 'px'});
	this.xmlEditorDiv.width(this.xmlContent.innerWidth());
	this.xmlEditorDiv.height(xmlEditorHeight);
	if (this.editor.modifyMenu.menuContainer != null){
		this.editor.modifyMenu.menuContainer.css({
			'max-height': $(this.editor.xmlWorkAreaContainer).height() - this.editor.modifyMenu.menuContainer.offset().top
		});
	}
	if (this.aceEditor != null)
		this.aceEditor.resize();
	return this;
};

// Count how many times tags named tagTitle occur in the xml document
TextEditor.prototype.tagOccurrences = function(string, tagTitle) {
	if (string == null || tagTitle == null)
		return 0;
	var matches = string.match(new RegExp("<" + tagTitle + "( |>|$)", "g"));
	return matches ? matches.length : 0;
};

// Select the tag currently encapsulating the cursor and refresh the editor to indicate this
TextEditor.prototype.selectTagAtCursor = function() {
	if (!this.isInitialized())
		return this;
	var currentLine = this.aceEditor.getSession().getDocument().getLine(this.aceEditor.selection.getCursor().row);
	var openingIndex = currentLine.lastIndexOf("<", this.aceEditor.selection.getCursor().column);
	var preceedingClosingIndex = currentLine.lastIndexOf(">", this.aceEditor.selection.getCursor().column);
	
	// Not inside a tag
	if (openingIndex <= preceedingClosingIndex)
		return this;
	
	var currentRow = this.aceEditor.selection.getCursor().row;
	var closingIndex = currentLine.indexOf(">", this.aceEditor.selection.getCursor().column);
	if (closingIndex == -1)
		closingIndex = currentLine.length - 1;
	
	
	var match = this.tagRegex.exec(currentLine.substring(openingIndex));
	
	// Check to see if the tag being selected is already selected.  If it is and the document hasn't been changed, then quit.
	if (match != null && !this.inSelectedTag(currentRow, openingIndex, closingIndex)){
		var tagTitle = match[1];
		var nsPrefix = match[2];
		var unprefixedTitle = match[3];
		if (!nsPrefix)
			nsPrefix = "";
		else nsPrefix = nsPrefix.substring(0, nsPrefix.length - 1);
		// Get the schema's namespace prefix for the namespace of the node from the document
		// Determine what namespace is bound in the document to the prefix on this node
		var documentNS = this.editor.xmlState.namespaces.namespaceURIs[nsPrefix];
		
		if (this.editor.xmlState.changesNotSynced()) {
			//Refresh the xml if it has changed
			try {
				this.editor.setXMLFromEditor();
				this.editor.xmlState.syncedChangeEvent();
			} catch (e) {
				// XML isn't valid, so can't continue
				return this;
			}
		}
		
		var Range = require("ace/range").Range;
		var range = new Range(0, 0, this.aceEditor.selection.getCursor().row, openingIndex);
		var preceedingLines = this.aceEditor.getSession().getDocument().getTextRange(range);
		
		var self = this;
		var instanceNumber = this.tagOccurrences(preceedingLines, tagTitle);
		// Find the element that matches this tag by occurrence number and tag name
		var elementNode = this.editor.xmlState.xml[0]
				.getElementsByTagName(tagTitle)[instanceNumber];
		if (!elementNode) {
			elementNode = $(unprefixedTitle, this.editor.xmlState.xml)
				.filter(function() {
					return this.namespaceURI == documentNS;
				})[instanceNumber];
		}
		
		if (!elementNode)
			return this;
		
		// Retrieve the schema definition for the selected node
		var elementDef = this.editor.schemaTree.getElementDefinition(elementNode);
		// Clear the menu if there was no definition or it was the root node
		if (elementDef == null || elementDef === this.editor.schemaTree.rootElement) {
			this.editor.modifyMenu.clearContextualMenus();
			return this;
		}
		
		// Create a dummy XMLElement so that the menu has something to point at
		var dummyTarget = null;
		try {
			dummyTarget = new XMLElement(elementNode, elementDef, this.editor);
		} catch(e) {
			return this;
		}
		
		// Refresh the menus to indicate the newly selected tag
		this.editor.modifyMenu.refreshContextualMenus(dummyTarget).setMenuPosition();
		
		this.selectedTagRange.row = currentRow;
		this.selectedTagRange.startColumn = openingIndex;
		this.selectedTagRange.endColumn = closingIndex;
		
		var Range = require("ace/range").Range;
		var markers = this.aceEditor.session.getMarkers();
		
		$.each(markers, function(index) {
			self.aceEditor.session.removeMarker(index);
		});
		this.aceEditor.session.addMarker(new Range(this.selectedTagRange.row, 
				this.selectedTagRange.startColumn, this.selectedTagRange.row, 
				this.selectedTagRange.endColumn + 1), "highlighted", "line", false);
	}
		
	return this;
};

// Inform the editor that an element was added into the XML document, causing it to refresh the 
// text in the editor and select the new tag
TextEditor.prototype.addElementEvent = function(parentElement, newElement) {
	this.reload();
	// Move cursor to the newly added element
	var instanceNumber = 0;
	var prefix = this.editor.xmlState.namespaces.getNamespacePrefix(newElement.objectType.namespace);
	var tagSelector = prefix.replace(':', '\\:') + newElement.objectType.localName;
	this.editor.xmlState.xml.find(tagSelector).each(function() {
		if (this === newElement.xmlNode.get(0)) {
			return false;
		}
		instanceNumber++;
	});
	var Range = require("ace/range").Range;
	var startPosition = new Range(0,0,0,0);
	var pattern = new RegExp("<(" + this.editor.options.targetPrefix + ":)?" + localName(newElement.xmlNode[0]) +"(\\s|\\/|>|$)", "g");
	this.aceEditor.find(pattern, {'regExp': true, 'start': startPosition, 'wrap': false});
	for (var i = 0; i < instanceNumber; i++) {
		this.aceEditor.findNext({'needle' : pattern});
	}
	this.aceEditor.clearSelection();
	this.aceEditor.selection.moveCursorBy(0, -1 * localName(newElement.xmlNode[0]).length);

	this.editor.xmlState.syncedChangeEvent();
};

// Inform the editor that a new attribute was added to the document
TextEditor.prototype.addAttributeEvent = function() {
	this.reload();
	this.editor.xmlState.syncedChangeEvent();
};
