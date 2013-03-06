/**
 * Manages and tracks the state of the underlying document being edited.
 */
function DocumentState(baseXML, editor) {
	this.baseXML = baseXML;
	this.xml = null;
	this.changeState = 0;
	this.editor = editor;
	this.setXMLFromString(this.baseXML);
	this.namespaces = new NamespaceList(editor.options.nameSpaces);
}

DocumentState.prototype.isChanged = function() {
	return this.changeState > 1;
};
DocumentState.prototype.isBaseDocument = function() {
	return this.changeState == 0;
};
DocumentState.prototype.changesSaved = function() {
	return this.changeState == 1;
};
DocumentState.prototype.changesSynced = function() {
	return this.changeState == 2;
};
DocumentState.prototype.changesNotSynced = function() {
	return this.changeState == 3;
};

DocumentState.prototype.documentChangedEvent = function() {
	this.changeState = 2;
	this.editor.undoHistory.captureSnapshot();
	this.updateStateMessage();
};

DocumentState.prototype.changesCommittedEvent = function() {
	this.changeState = 1;
	this.updateStateMessage();
};

DocumentState.prototype.changeEvent = function() {
	if (this.changeState < 2)
		this.changeState = 2;
	this.updateStateMessage();
};

DocumentState.prototype.syncedChangeEvent = function() {
	this.changeState = 2;
	this.updateStateMessage();
};

DocumentState.prototype.unsyncedChangeEvent = function() {
	this.changeState = 3;
	this.updateStateMessage();
};

DocumentState.prototype.updateStateMessage = function () {
	if (this.isChanged()) {
		$("." + submissionStatusClass).html("Unsaved changes");
	} else {
		$("." + submissionStatusClass).html("All changes saved");
	}
};

DocumentState.prototype.extractNamespacePrefixes = function(nsURI) {
	var prefix = null;
	var attributes = this.xml.children()[0].attributes;
	var self = this;
	$.each(attributes, function(){
		var key = this.name;
		var value = this.value;
		if (key.indexOf("xmlns") == 0){
			if ((prefixIndex = key.indexOf(":")) > 0){
				prefix = key.substring(prefixIndex+1)
			} else {
				prefix = "";
			}
			self.namespaces.addNamespace(value, prefix);
		}
	});
};

DocumentState.prototype.setXMLFromString = function(xmlString) {
	// parseXML doesn't return any info on why a document is invalid, so do it the old fashion way.
	if (window.DOMParser) {
		parser = new DOMParser();
		if (this.editor.options.prettyXML) {
			xmlString = vkbeautify.xml(xmlString);
		}
		xmlDoc = parser.parseFromString(xmlString, "application/xml");
		
		var parseError = xmlDoc.getElementsByTagName("parsererror");
		if (parseError.length > 0){
			throw new Error($(parseError).text());
		}
	} else {
		// Internet Explorer
		xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
		xmlDoc.async = false;
		if (this.editor.options.prettyXML) {
			xmlString = vkbeautify.xml(xmlString);
		}
		xmlDoc.loadXML(xmlString);
		if (xmlDoc.parseError.errorCode != 0) {
			throw new Error("Error in line " + xmlDoc.parseError.line + " position " + xmlDoc.parseError.linePos
					+ "\nError Code: " + xmlDoc.parseError.errorCode + "\nError Reason: "
					+ xmlDoc.parseError.reason + "Error Line: " + xmlDoc.parseError.srcText);
		}
	}
	this.xml = $(xmlDoc);
	if (this.editor.guiEditor != null && this.editor.guiEditor.rootElement != null)
		this.editor.guiEditor.rootElement.xmlNode = this.xml.children().first();
	if (this.editor.guiEditor.xmlContent != null)
		this.editor.guiEditor.xmlContent.data("xml").elementNode = this.xml.children().first();
	if (this.editor.problemsPanel != null)
		this.editor.clearProblemPanel();
};
