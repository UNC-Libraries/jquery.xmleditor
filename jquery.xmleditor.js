;(function($){


/*

	Copyright 2008 The University of North Carolina at Chapel Hill

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

			http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.

 */
/*
 * jQuery xml Editor
 * 
 * Dependencies:
 *   jquery 1.7+
 *   jquery.ui 1.7+
 *   ajax ace editor
 *   jquery.xmlns.js
 *   jquery.autosize.js (optional)
 *   vkbeautify.0.98.01.beta.js (optional)
 * 
 * @author Ben Pennell
 */

 
var menuContainerClass = "xml_menu_container";
var menuHeaderClass = "menu_header";
var menuColumnClass = "xml_menu_column";
var menuContentClass = 'menu_content';
var menuExpandDuration = 180;
var xmlElementClass = 'xml_element';
var topLevelContainerClass = 'top_level_element_group';
var elementRootPrefix = "root_element_";
var elementPrefix = "xml_element_";
var childrenContainerSelector = " > .xml_children";
var childrenContainerClass = "xml_children";
var attributeContainerClass = "attribute_container";
var attributesContainerSelector = " > .xml_attrs";
var attributesContainerClass = "xml_attrs";
var xmlMenuHeaderPrefix = "xml_header_item_";
var xmlEditorContainerClass = "xml_editor_container";
var xmlWorkAreaContainerClass = "xml_work_area";
var addTopMenuClass = "add_top_menu";
var addAttrMenuClass = "add_attribute_menu";
var addElementMenuClass = "add_element_menu";
var xmlMenuBarClass = "xml_menu_bar";
var submitButtonClass = "send_xml";
var submissionStatusClass = "xml_submit_status";
var xmlContentClass = "xml_content";

var editorTabAreaClass = "xml_tab_area";
var problemsPanelClass = "xml_problems_panel";
var guiContentClass = "gui_content";
var textContentClass = "text_content";
var editorHeaderClass = "xml_editor_header";

$.widget( "xml.xmlEditor", {
	options: {
		schema: null,
		loadSchemaAsychronously: true,
		libPath: null,
		ajaxOptions : {
			xmlUploadPath: null,
			xmlRetrievalPath: null,
			xmlRetrievalParams : null
		},
		localXMLContentSelector: this.element,
		
		documentTitle : null,
		addTopMenuHeaderText : 'Add Top Element',
		addAttrMenuHeaderText : 'Add Attribute',
		addElementMenuHeaderText : 'Add Subelement',
		
		confirmExitWhenUnsubmitted : true,
		enableGUIKeybindings : true,
		floatingMenu : true,
		expandingTextAreas: true,
		
		prettyXML : true,
		undoHistorySize: 20,
		menuEntries: undefined,
		submitResponseHandler : null,
		
		namespaces: null,
		targetNS: null,
		targetPrefix: null
	},
	
	_create: function() {
		var self = this;
		this.instanceNumber = $("xml-xmlEditor").length;
		
		// Tree of xml element types
		this.xmlTree = null;
		// State of the XML document
		this.xmlState = null;
		// Container for the entire editor
		this.xmlEditorContainer = null;
		// Container for the subeditors
		this.xmlWorkAreaContainer = null;
		// Tabbed container for differentiating between specific subeditors
		this.xmlTabContainer = null;
		// Header container for the menu and top level info
		this.editorHeader = null;
		// Panel for displaying errors
		this.problemsPanel = null;
		// GUI Editor object
		this.guiEditor = null;
		// Text Editor object
		this.textEditor = null;
		// Currently active editor
		this.activeEditor = null;
		// History manager for undo/redo
		this.undoHistory = null;
		// Top level menu bar object
		this.menuBar = null;
		// Element modification object
		this.modifyMenu = null;
		
		var url = document.location.href;
		var index = url.lastIndexOf("/");
		if (index != -1)
			this.baseUrl = url.substring(0, index + 1);
		
		// Detect optional features
		if (!$.isFunction($.fn.autosize))
			this.options.expandingTextAreas = false;
		if (!vkbeautify)
			this.options.prettyXML = false;
		
		// Turn relative paths into absolute paths for the sake of web workers
		if (this.options.libPath) {
			if (this.options.libPath.indexOf('http') != 0)
				this.libPath = this.baseUrl + this.options.libPath;
			else this.libPath = this.options.libPath;
		} else this.libPath = this.baseUrl + "lib/";
		if ((typeof this.options.schema == 'string' || typeof this.options.schema instanceof String)
				&& this.options.schema.indexOf('http') != 0)
			this.options.schema = this.baseUrl + this.options.schema;
		
		this.loadSchema(this.options.schema);
	},
 
	_init: function() {
		if (this.options.submitResponseHandler == null)
			this.options.submitResponseHandler = this.swordSubmitResponseHandler;
		
		// Retrieve the local xml content before we start populating the editor.
		var localXMLContent = null;
		if ($(this.options.localXMLContentSelector).is("textarea")) {
			localXMLContent = $(this.options.localXMLContentSelector).val(); 
		} else {
			localXMLContent = this.element.html();
		}
		this.element.empty();
		
		this.xmlState = null;
		
		this.xmlEditorContainer = $("<div/>").attr('class', xmlEditorContainerClass).appendTo(this.element);
		this.xmlWorkAreaContainer = null;
		this.xmlTabContainer = null;
		
		this.editorHeader = null;
		this.problemsPanel = null;
		
		this.guiEditor = new GUIEditor(this);
		this.textEditor = new TextEditor(this);
		this.activeEditor = this.guiEditor;
		
		var self = this;
		this.undoHistory = new UndoHistory(this);
		this.undoHistory.setStateChangeEvent(function() {
			self.refreshDisplay();
		});

		this.menuBar = new MenuBar(this);
		this.menuBar.updateFunctions.push(this.refreshMenuUndo);
		this.menuBar.updateFunctions.push(this.refreshMenuSelected);
		if (this.options.menuEntries) {
			$.each(this.options.menuEntries, function() {
				self.menuBar.addEntry(this);
			});
		}
		this.modifyMenu = new ModifyMenuPanel(this);
		
		if (this.options.enableGUIKeybindings)
			$(window).keydown(function(e){
				self.keydownCallback(e);
			});
		if (this.options.confirmExitWhenUnsubmitted) {
			$(window).bind('beforeunload', function(e) {
				if (self.xmlState != null && self.xmlState.isChanged()) {
					return "The document contains unsaved changes.";
				}
			});
		}
		
		this.loadDocument(this.options.ajaxOptions, localXMLContent);
	},
	
	loadSchema: function(schema) {
		var self = this;
		// If the schema is a function, execute it to get the schema from it.
		if (jQuery.isFunction(schema)) {
			this.schema = schema.apply();
			self._schemaReady();
		} else {
			if (this.options.loadSchemaAsychronously && typeof(Worker) !== "undefined" && typeof(Blob) !== "undefined") {
				var blob = new Blob([
						"self.onmessage = function(e) {" +
						"importScripts(e.data.libPath + 'cycle.js');" +
						"var schema;" +
						"if (typeof e.data.schema == 'string' || typeof e.data.schema instanceof String) {" +
						"	var xmlhttp = new XMLHttpRequest();" +
						"	xmlhttp.onreadystatechange = function() {" +
						"		if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {" +
						"			schema = eval('(' + xmlhttp.responseText + ')');" +
						"			self.postMessage(JSON.retrocycle(schema));" +
						"		}" +
						"	};" +
						"	xmlhttp.open('GET', e.data.schema, true);" +
						"	xmlhttp.send();" +
						"} else {" +
						"	schema = JSON.retrocycle(e.data.schema);" +
						"	self.postMessage(schema);" +
						"}" +
						"}"
				], { type: "text/javascript" });
				var worker = new Worker(window.URL.createObjectURL(blob));
				worker.onmessage = function(e) {
					self.schema = e.data;
					self._schemaReady();
					worker.terminate();
				};
				worker.onerror = function(e) {
					console.log("Asynchronous schema loading failed, doing it the old fashion way", e);
					self.schema = JSON.retrocycle(schema);
					self._schemaReady();
				};
				console.time("retro");
				console.log("Requesting", schema);
				worker.postMessage({'schema' : schema, 'libPath' : this.libPath});
			} else {
				if (typeof schema == 'string' || typeof schema instanceof String) {
					$.ajax({
						url : schema,
						async : self.options.loadSchemaAsynchronously,
						dataType : 'json',
						success : function(data) {
							self.schema = data;
							self._schemaReady();
						}
					});
				} else {
					self.schema = JSON.retrocycle(schema);
					self._schemaReady();
				}
			}
		}
	},
	
	loadDocument: function(ajaxOptions, localXMLContent) {
		if (ajaxOptions != null && ajaxOptions.xmlRetrievalPath != null) {
			var self = this;
			$.ajax({
				type : "GET",
				url : ajaxOptions.xmlRetrievalPath,
				data : (ajaxOptions.xmlRetrievalParams),
				dataType : "text",
				success : function(data) {
					self._documentReady(data);
				}
			});
		} else {
			this._documentReady(localXMLContent);
		}
	},
	
	_documentReady : function(xmlString) {
		console.time("Load");
		//console.profile();
		this.xmlState = new DocumentState(xmlString, this);
		this.xmlState.extractNamespacePrefixes();
		//console.profileEnd();
		console.timeEnd("Load");
		this._documentAndSchemaReady();
	},
	
	_schemaReady : function() {
		if (!this.options.targetNS) {
			this.targetNS = this.schema.namespace;
		}
		this.xmlTree = new SchemaTree(this.schema);
		this.xmlTree.build();
		this._documentAndSchemaReady();
	},
	
	_documentAndSchemaReady : function() {
		// Join back up asynchronous loading of document and schema
		if (!this.xmlTree || !this.xmlState)
			return;
		// Add namespaces into jquery
		this.xmlState.namespaces.namespaceURIs = $.extend({}, this.xmlTree.namespaces.namespaceURIs, this.xmlState.namespaces.namespaceURIs);
		this.xmlState.namespaces.namespaceToPrefix = $.extend({}, this.xmlTree.namespaces.namespaceToPrefix, this.xmlState.namespaces.namespaceToPrefix);
		this.targetPrefix = this.xmlState.namespaces.getNamespacePrefix(this.options.targetNS);
		if (this.targetPrefix != "")
			this.targetPrefix += ":";
		
		this.constructEditor();
		this.refreshDisplay();
		// Capture baseline undo state
		this.undoHistory.captureSnapshot();
	},
	
	constructEditor: function() {
		// Work Area
		this.xmlWorkAreaContainer = $("<div/>").attr('class', xmlWorkAreaContainerClass).appendTo(this.xmlEditorContainer);
		
		// Menu bar
		this.editorHeader = $("<div/>").attr('class', editorHeaderClass).appendTo(this.xmlWorkAreaContainer);
		if (this.options.documentTitle != null)
			$("<h2/>").html("Editing Description: " + this.options.documentTitle).appendTo(this.editorHeader);
		this.menuBar.render(this.editorHeader);
		
		this.xmlTabContainer = $("<div/>").attr("class", editorTabAreaClass).css("padding-top", this.editorHeader.height() + "px").appendTo(this.xmlWorkAreaContainer);
		this.problemsPanel = $("<pre/>").attr('class', problemsPanelClass).hide().appendTo(this.xmlTabContainer);
		
		this.guiEditor.initialize(this.xmlTabContainer);
		this.modeChange(0);
		
		var self = this;
		$(window).resize(function() {
			self.xmlTabContainer.width(self.xmlEditorContainer.outerWidth() - self.modifyMenu.menuColumn.outerWidth());
			if (self.activeEditor != null){
				self.activeEditor.resize();
			}
			self.editorHeader.width(self.xmlTabContainer.width());
			if (self.options.floatingMenu) {
				self.modifyMenu.setMenuPosition();
			}
		});
		
		this.modifyMenu.initialize(this.xmlEditorContainer);
		this.modifyMenu.addMenu(addElementMenuClass, this.options.addElementMenuHeaderText, 
				true, false, true);
		this.modifyMenu.addAttributeMenu(addAttrMenuClass, this.options.addAttrMenuHeaderText, 
				true, false, true);
		this.modifyMenu.addMenu(addTopMenuClass, this.options.addTopMenuHeaderText, 
				true, true).populate(this.guiEditor.rootElement, this.schema);
		
		if (this.options.floatingMenu) {
			$(window).bind('scroll', $.proxy(this.modifyMenu.setMenuPosition, this.modifyMenu));
		}
		
		$("." + submitButtonClass).click(function() {
			self.saveXML();
		});
		//$(window).resize();
		//this.refreshDisplay();
	},
	
	addChildElementCallback: function (instigator) {
		var xmlElement = $(instigator).data("xml").target;
		var objectType = $(instigator).data("xml").objectType;
		
		if (this.textEditor.active) {
			// Refresh xml state
			if (this.xmlState.changesNotSynced()) {
				try {
					this.setXMLFromEditor();
				} catch (e) {
					this.addProblem("Unable to add element, please fix existing XML syntax first.", e);
					return;
				}
			}
		}
		
		var newElement = xmlElement.addElement(objectType);
		
		this.activeEditor.addElementEvent(xmlElement, newElement);
	},
	
	addAttributeButtonCallback: function(instigator) {
		if ($(instigator).hasClass("disabled"))
			return;
		if (this.xmlState.changesNotSynced()) {
			try {
				this.setXMLFromEditor();
			} catch (e) {
				alert(e.message);
				return;
			}
		}
		var data = $(instigator).data('xml');
		data.target.addAttribute(data.objectType);
		
		this.activeEditor.addAttributeEvent(data.target, data.objectType, $(instigator));
	},
	
	modeChange: function(mode) {
		if (mode == 0) {
			if (this.textEditor.isInitialized() && this.xmlState.isChanged()) {
				// Try to reconstruct the xml object before changing tabs.  Cancel change if parse error to avoid losing changes.
				try {
					this.setXMLFromEditor();
				} catch (e) {
					this.addProblem("Invalid xml", e);
					return false;
				}
				this.undoHistory.captureSnapshot();
			}
		}
		
		$(".active_mode_tab").removeClass("active_mode_tab");
		this.modifyMenu.clearContextualMenus();
		if (this.activeEditor != null) {
			this.activeEditor.deactivate();
		}
		if (mode == 0) {
			this.activeEditor = this.guiEditor;
			$("#" + xmlMenuHeaderPrefix + "XML").addClass("active_mode_tab");
		} else {
			this.activeEditor = this.textEditor;
			$("#" + xmlMenuHeaderPrefix + "Text").addClass("active_mode_tab");
		}
		this.activeEditor.activate();
	},
	
	refreshDisplay: function() {
		if (this.activeEditor == null)
			return;
		this.activeEditor.refreshDisplay();
		
		if (this.options.floatingMenu) {
			this.modifyMenu.setMenuPosition();
		}
		this.xmlWorkAreaContainer.width(this.xmlEditorContainer.outerWidth() - this.modifyMenu.menuColumn.outerWidth());
	},
	
	setXMLFromEditor: function() {
		var xmlString = this.textEditor.aceEditor.getValue();
		this.xmlState.setXMLFromString(xmlString);
	},
	
	saveXML: function() {
		if (this.options.ajaxOptions.xmlUploadPath != null) {
			this.submitXML();
		} else {
			// Implement later when there is more browser support for html5 File API
			this.exportXML();
		}
	},
	
	exportXML: function() {
		if (typeof(Blob) === "undefined") {
			this.addProblem("Browser does not support saving files via this editor.  To save, copy and paste the document from the Text view.");
			return false;
		}
		
		var exportDialog = $("<form><input type='text' class='xml_export_filename' placeholder='file.xml'/><input type='submit' value='Export'/></form>")
				.dialog({modal: true, dialogClass: 'xml_dialog', resizable : false, title: 'Enter file name', height: 80});
		var self = this;
		exportDialog.submit(function(){
			if (self.textEditor.active) {
				try {
					self.setXMLFromEditor();
				} catch (e) {
					self.xmlState.setDocumentHasChanged(true);
					$("." + submissionStatusClass).html("Failed to save<br/>See errors at top").css("background-color", "#ffbbbb").animate({backgroundColor: "#ffffff"}, 1000);
					self.addProblem("Cannot save due to invalid xml", e);
					return false;
				}
			}
			var xmlString = self.xml2Str(self.xmlState.xml);
			var blob = new Blob([xmlString], { type: "text/xml" }); 
			var url = URL.createObjectURL(blob);
			
			exportDialog.dialog('option', 'title', '');
			var fileName = exportDialog.find('input[type="text"]').val();
			if (!fileName)
				fileName = "file.xml";
			var download = $('<a>Download ' + fileName + '</a>').attr("href", url);
			download.attr("download", fileName);
			exportDialog.empty().append(download);
			return false;
		});
	},

	submitXML: function() {
		if (this.textEditor.active) {
			try {
				this.setXMLFromEditor();
			} catch (e) {
				this.xmlState.setDocumentHasChanged(true);
				$("." + submissionStatusClass).html("Failed to submit<br/>See errors at top").css("background-color", "#ffbbbb").animate({backgroundColor: "#ffffff"}, 1000);
				this.addProblem("Cannot submit due to invalid xml", e);
				return false;
			}
		}
		
		// convert XML DOM to string
		var xmlString = this.xml2Str(this.xmlState.xml);

		$("." + submissionStatusClass).html("Submitting...");
		
		var self = this;
		$.ajax({
			'url' : this.options.ajaxOptions.xmlUploadPath,
			'contentType' : "application/xml",
			'type' : "POST",
			'data' : xmlString,
			success : function(response) {
				var outcome = self.options.submitResponseHandler(response);
				
				if (!outcome) {
					self.xmlState.changesCommittedEvent();
					self.clearProblemPanel();
				} else {
					self.xmlState.syncedChangeEvent();
					$("." + submissionStatusClass).html("Failed to submit<br/>See errors at top").css("background-color", "#ffbbbb").animate({backgroundColor: "#ffffff"}, 1000);
					self.addProblem("Failed to submit xml document", outcome);
				}
			},
			error : function(jqXHR, exception) {
				if (jqXHR.status === 0) {
					alert('Not connect.\n Verify Network.');
				} else if (jqXHR.status == 404) {
					alert('Requested page not found. [404]');
				} else if (jqXHR.status == 500) {
					alert('Internal Server Error [500].');
				} else if (exception === 'parsererror') {
					alert('Requested JSON parse failed.');
				} else if (exception === 'timeout') {
					alert('Time out error.');
				} else if (exception === 'abort') {
					alert('Ajax request aborted.');
				} else {
					alert('Uncaught Error.\n' + jqXHR.responseText);
				}
			}
		});
	},
	
	swordSubmitResponseHandler: function(response) {
		var responseObject = $(response);
		if (responseObject.length > 0 && responseObject[responseObject.length - 1].localName == "sword:error") {
			return responseObject.find("atom\\:summary").html();
		}
		return false;
	},

	// convert xml DOM to string
	xml2Str: function(xmlNodeObject) {
		if (xmlNodeObject == null)
			return;
		var xmlNode = (xmlNodeObject instanceof jQuery? xmlNodeObject[0]: xmlNodeObject);
		var xmlStr = "";
		try {
			// Gecko-based browsers, Safari, Opera.
			xmlStr = (new XMLSerializer()).serializeToString(xmlNode);
		} catch (e) {
			try {
				// Internet Explorer.
				xmlStr = xmlNode.xml;
			} catch (e) {
				this.addProblem('Xmlserializer not supported', e);
				return false;
			}
		}
		if (this.options.prettyXML)
			xmlStr = vkbeautify.xml(xmlStr);
		return xmlStr;
	},
	
	getParentObject: function(object, suffix) {
		var objectId = $(object).attr('id');
		var parentId = objectId.substring(0, objectId.indexOf(suffix));
		
		var parentObject = $("#" + parentId);
		if (parentObject.length == 0)
			return;
		
		return parentObject;
	},
	
	addProblem: function(message, problem) {
		this.problemsPanel.html(message + "<br/>");
		if (problem !== undefined) {
			if (problem.substring) {
				this.problemsPanel.append(problem.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
			} else {
				this.problemsPanel.append(problem.message.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
			}
		}
		this.refreshProblemPanel();
	},
	
	clearProblemPanel: function() {
		this.problemsPanel.hide();
	},
	
	refreshProblemPanel: function() {
		if (this.problemsPanel.html() == "") {
			this.problemsPanel.hide("fast");
		} else {
			this.problemsPanel.show("fast");
		}
	},

	nsEquals: function(node, element, elementNS) {
		if (element.substring)
			return element == node.localName && elementNS == node.namespaceURI;
		return element.localName == node.localName && node.namespaceURI == element.namespace;
	},
	
	getXPath: function(element) {
		var xpath = '';
		for ( ; element && element.nodeType == 1; element = element.parentNode ) {
			var id = $(element.parentNode).children(element.tagName.replace(":", "\\:")).index(element) + 1;
			id = ('[' + id + ']');
			if (element.tagName.indexOf("xml:") == -1)
				xpath = '/xml:' + element.tagName + id + xpath;
			else xpath = '/' + element.tagName + id + xpath;
		}
		return xpath;
	},
				
	keydownCallback: function(e) {
		if (this.guiEditor.active) {
			var focused = $("input:focus, textarea:focus, select:focus");
			
			// Escape key, blur the currently selected input or deselect selected element
			if (e.keyCode == 27) {
				if (focused.length > 0)
					focused.blur();
				else this.guiEditor.selectElement(null);
				return false;
			}
			
			// Enter, focus the first visible input
			if (e.keyCode == 13 && focused.length == 0) {
				e.preventDefault();
				this.guiEditor.focusSelectedText();
				return false;
			}
			
			// Tab, select the next input
			if (e.keyCode == 9) {
				e.preventDefault();
				this.guiEditor.focusInput(e.shiftKey);
				return false;
			}
			
			// Delete key press while item selected but nothing is focused.
			if (e.keyCode == 46 && focused.length == 0) {
				this.guiEditor.deleteSelected();
				return false;
			}
			
			if (e.keyCode > 36 && e.keyCode < 41 && focused.length == 0){
				e.preventDefault();
				if (e.altKey) {
					// Alt + up or down move the element up and down in the document
					this.guiEditor.moveSelected(e.keyCode == 38);
				} else if (e.shiftKey) {
					// If holding shift while pressing up or down, then jump to the next/prev sibling
					if (e.keyCode == 40 || e.keyCode == 38) {
						this.guiEditor.selectSibling(e.keyCode == 38);
					} else if (e.keyCode == 37 || e.keyCode == 39) {
						this.guiEditor.selectParent(e.keyCode == 39);
					}
				} else {
					// If not holding shift while hitting up or down, go to the next/prev element
					if (e.keyCode == 40 || e.keyCode == 38){
						this.guiEditor.selectNext(e.keyCode == 38);
					} else if (e.keyCode == 37 || e.keyCode == 39) {
						this.guiEditor.selectAttribute(e.keyCode == 37);
					}
				}
				return false;
			}
			
			if ((e.metaKey || e.ctrlKey) && focused.length == 0 && e.keyCode == 'Z'.charCodeAt(0)) {
				// Undo
				this.undoHistory.changeHead(e.shiftKey? 1: -1);
				return false;
			} else if ((e.metaKey || e.ctrlKey) && focused.length == 0 && e.keyCode == 'Y'.charCodeAt(0)){
				// Redo
				this.undoHistory.changeHead(1);
				return false;
			}
		}
		
		// Save, on either tab.
		if (e.altKey && e.shiftKey && e.keyCode == 'S'.charCodeAt(0)) {
			$("." + submitButtonClass).click();
			return false;
		}
		
		if (e.altKey && e.shiftKey && e.keyCode == 'E'.charCodeAt(0)) {
			this.exportXML();
			return false;
		}
		
		if (e.altKey && e.shiftKey && e.keyCode == 'X'.charCodeAt(0)) {
			this.modeChange(0);
			return false;
		}
		
		if (e.altKey && e.shiftKey && e.keyCode == 'T'.charCodeAt(0)) {
			this.modeChange(1);
			return false;
		}
		
		return true;
	},
	
	/**
	 * Menu Update functions
	 */
	refreshMenuUndo: function(self) {
		if (self.undoHistory.headIndex > 0) {
			$("#" + xmlMenuHeaderPrefix + "Undo").removeClass("disabled").data("menuItemData").enabled = true;
		} else {
			$("#" + xmlMenuHeaderPrefix + "Undo").addClass("disabled").data("menuItemData").enabled = false;
		}
		if (self.undoHistory.headIndex < self.undoHistory.states.length - 1) {
			$("#" + xmlMenuHeaderPrefix + "Redo").removeClass("disabled").data("menuItemData").enabled = true;
		} else {
			$("#" + xmlMenuHeaderPrefix + "Redo").addClass("disabled").data("menuItemData").enabled = false;
		}
	},
	
	refreshMenuSelected: function(self) {
		var suffixes = ['Deselect', 'Next_Element', 'Previous_Element', 'Parent', 'First_Child', 'Next_Sibling', 
						'Previous_Sibling', 'Next_Attribute', 'Previous_Attribute', 'Delete', 'Move_Element_Up', 
						'Move_Element_Down'];
		var hasSelected = self.guiEditor.selectedElement != null && self.guiEditor.active;
		$.each(suffixes, function(){
			if (hasSelected)
				$("#" + xmlMenuHeaderPrefix + this.toString()).removeClass("disabled").data("menuItemData").enabled = true;
			else $("#" + xmlMenuHeaderPrefix + this.toString()).addClass("disabled").data("menuItemData").enabled = false;
		});
	},
});
function AbstractXMLObject(editor, objectType) {
	this.editor = editor;
	this.guiEditor = this.editor.guiEditor;
	this.objectType = objectType;
}

AbstractXMLObject.prototype.createElementInput = function (inputID, startingValue, appendTarget){
	var input = null;
	var $input = null;
	if (this.objectType.values.length > 0){
		var selectionValues = this.objectType.values;
		input = document.createElement('select');
		input.id = inputID;
		input.className = 'xml_select';
		appendTarget.appendChild(input);
		
		for (var index in selectionValues) {
			var selectionValue = selectionValues[index];
			var option = new Option(selectionValue.toString(), selectionValue);
			input.options[index] = option;
			if (startingValue == selectionValue) {
				input.options[index].selected = true;
			}
		}
		$input = $(input);
	} else if ((this.objectType.element && (this.objectType.type == 'string' || this.objectType.type == 'mixed')) 
			|| this.objectType.attribute){
		input = document.createElement('textarea');
		input.id = inputID;
		input.className = 'xml_textarea';
		input.value = startingValue;
		appendTarget.appendChild(input);
		
		$input = $(input);
		var self = this;
		$input.one('focus', function() {
			if (!self.objectType.attribute && self.editor.options.expandingTextAreas)
				$input.autosize();
			if (this.value == " ")
				this.value = "";
		});
	} else if (this.objectType.type){
		input = document.createElement('input');
		input.type = 'text';
		input.id = inputID;
		input.className = 'xml_input';
		input.value = startingValue;
		appendTarget.appendChild(input);
		
		$input = $(input);
		$input.one('focus', function() {
			if (this.value == " ")
				this.value = "";
		});
	}
	return $input;
};

AbstractXMLObject.prototype.focus = function() {
	if (this.getDomElement() != null)
		this.guiEditor.focusObject(this.getDomElement());
};

AbstractXMLObject.prototype.getDomElement = function () {
	return null;
};
function AttributeMenu(menuID, label, expanded, enabled, owner) {
	ModifyElementMenu.call(this, menuID, label, expanded, enabled, owner);
}

AttributeMenu.prototype.constructor = AttributeMenu;
AttributeMenu.prototype = Object.create( ModifyElementMenu.prototype );

AttributeMenu.prototype.initEventHandlers = function() {
	this.menuContent.on('click', 'li', function(event){
		self.owner.editor.addAttributeButtonCallback(this);
	});
};

AttributeMenu.prototype.populate = function (xmlElement) {
	if (xmlElement == null || (this.target != null && xmlElement.guiElement != null 
			&& this.target[0] === xmlElement.guiElement[0]))
		return;
	
	if (this.expanded)
		this.menuContent.css("height", "auto");
	var startingHeight = this.menuContent.outerHeight();
	this.menuContent.empty();
	
	this.target = xmlElement;
	
	var attributesArray = this.target.objectType.attributes;
	var attributesPresent = {};
	$(this.target.xmlNode[0].attributes).each(function() {
		var targetAttribute = this;
		$.each(attributesArray, function(){
			if (this.name == targetAttribute.nodeName) {
				attributesPresent[this.name] = $("#" + xmlElement.guiElementID + "_" + targetAttribute.nodeName.replace(':', '-'));
			}
		});
	});
	
	var self = this;
	$.each(this.target.objectType.attributes, function(){
		var attribute = this;
		var addButton = $("<li/>").attr({
			title : 'Add ' + attribute.name,
			'id' : xmlElement.guiElementID + "_" + attribute.nameEsc + "_add"
		}).html(attribute.name).click(function(){
			self.owner.editor.addAttributeButtonCallback(this);
		}).data('xml', {
				"objectType": attribute,
				"target": xmlElement
		}).appendTo(self.menuContent);
		
		if (attribute.name in attributesPresent) {
			addButton.addClass("disabled");
			if (attributesPresent[attribute.name].length > 0)
				attributesPresent[attribute.name].data('xmlAttribute').addButton = addButton;
		}
	});
	if (this.expanded) {
		var endingHeight = this.menuContent.outerHeight();
		if (endingHeight == 0)
			endingHeight = 1;
		this.menuContent.css({height: startingHeight + "px"}).stop().animate({height: endingHeight + "px"}, menuExpandDuration).show();
	}
	
	if (this.menuContent.children().length == 0) {
		this.menuHeader.addClass("disabled");
		this.enabled = false;
	} else {
		this.menuHeader.removeClass("disabled");
		this.enabled = true;
	}
	
	return this;
};
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
function GUIEditor(editor) {
	this.editor = editor;
	this.guiContent = null;
	this.xmlContent = null;
	this.elementIndex = 0;
	this.rootElement = null;
	this.active = false;
	this.selectedElement = null;
	
}

GUIEditor.prototype.initialize = function(parentContainer) {
	this.xmlContent = $("<div class='" + xmlContentClass + "'/>");
	this.xmlContent.data("xml", {});
	var placeholder = $("<div/>").attr("class", "placeholder").html("There are no elements in this document.  Use the menu on the right to add new top level elements.")
			.appendTo(this.xmlContent);
	
	this.guiContent = $("<div/>").attr({'id' : guiContentClass + this.editor.instanceNumber, 'class' : guiContentClass}).appendTo(parentContainer);
	//this.guiContent = parentContainer;
	
	this.guiContent.append(this.xmlContent);
	
	this.rootElement = new XMLElement(this.editor.xmlState.xml.children().first(), this.editor.schema, this.editor);
	this.rootElement.guiElement = this.xmlContent;
	this.rootElement.guiElement.data("xmlElement", this.rootElement);
	this.rootElement.childContainer = this.xmlContent;
	this.rootElement.placeholder = placeholder;
	this.rootElement.initializeGUI();
	
	this._initEventBindings();
	return this;
};

GUIEditor.prototype._initEventBindings = function() {
	var self = this;
	// Attributes
	this.xmlContent.on('click', '.' + attributeContainerClass, function(event){
		$(this).data('xmlAttribute').select();
		event.stopPropagation();
	}).on('click', '.' + attributeContainerClass + " > a", function(event){
		$(this).parents('.' + attributeContainerClass).eq(0).data('xmlAttribute').remove();
		event.stopPropagation();
	}).on('change', '.' + attributeContainerClass + ' > input,.' + attributeContainerClass + ' > textarea', function(event){
		$(this).parents('.' + attributeContainerClass).eq(0).data('xmlAttribute').syncValue();
		self.editor.xmlState.documentChangedEvent();
	});
	// Element
	this.xmlContent.on('click', '.' + xmlElementClass, function(event){
		self.selectElement(this);
		event.stopPropagation();
	}).on('click', '.move_up', function(event){
		self.moveElement($(this).parents('.' + xmlElementClass).eq(0).data('xmlElement'), true);
		event.stopPropagation();
	}).on('click', '.move_down', function(event){
		self.moveElement($(this).parents('.' + xmlElementClass).eq(0).data('xmlElement'));
		event.stopPropagation();
	}).on('click', '.top_actions .delete', function(event){
		self.deleteElement($(this).parents('.' + xmlElementClass).eq(0).data('xmlElement'));
		event.stopPropagation();
	});
};

GUIEditor.prototype.activate = function() {
	this.guiContent.show();
	this.active = true;
	this.deselect();
	
	this.editor.textEditor.resetSelectedTagRange();
	if (this.editor.textEditor.isModified() || (this.editor.textEditor.isInitialized() && this.editor.xmlState.isChanged())) {
		this.editor.refreshDisplay();
		this.editor.textEditor.setInitialized();
	}
	
	return this;
};

GUIEditor.prototype.deactivate = function() {
	this.active = false;
	this.guiContent.hide();
	return this;
};

GUIEditor.prototype.nextIndex = function() {
	return xmlElementClass + (++this.elementIndex);
};

GUIEditor.prototype.clearElements = function() {
	$("." + topLevelContainerClass).remove();
	return this;
};

GUIEditor.prototype.resize = function() {
	//xmlContent.width(guiContent.width() - menuContainer.width() - 30);
	return this;
};

GUIEditor.prototype.refreshDisplay = function() {
	this.deselect();
	this.elementIndex = 0;
	this.rootElement.xmlNode = this.editor.xmlState.xml.children().first();
	this.refreshElements();
	return this;
};

GUIEditor.prototype.refreshElements = function() {
	console.time("rendering children");
	var node = this.rootElement.getDomElement()[0];
	var originalParent = node.parentNode;
	var fragment = document.createDocumentFragment();
	fragment.appendChild(node);
	
	this.rootElement.renderChildren(true);
	
	originalParent.appendChild(fragment);
	console.timeEnd("rendering children");
	return this;
};

GUIEditor.prototype.addElementEvent = function(parentElement, newElement) {
	if (parentElement.guiElementID != this.xmlContent.attr("id")) {
		parentElement.updated();
	}
	this.focusObject(newElement.guiElement);
	this.selectElement(newElement);
	
	this.editor.xmlState.documentChangedEvent();
};

GUIEditor.prototype.addAttributeEvent = function(parentElement, objectType, addButton) {
	var attribute = new XMLAttribute(objectType, parentElement, this.editor);
	attribute.render();
	parentElement.updated();
	this.focusObject(attribute.attributeContainer);
	addButton.addClass("disabled");
	attribute.addButton = addButton;
	this.editor.xmlState.documentChangedEvent();
};

GUIEditor.prototype.selectElement = function(selected) {
	if (!selected || selected.length == 0) {
		this.deselect();
	} else {
		$("." + xmlElementClass + ".selected").removeClass("selected");
		$('.' + attributeContainerClass + ".selected").removeClass("selected");
		if (selected instanceof XMLElement){
			this.selectedElement = selected;
		} else {
			selected = $(selected);
			this.selectedElement = selected.data("xmlElement");
			selected = this.selectedElement;
		}
		selected.select();
		this.editor.modifyMenu.refreshContextualMenus(selected);
	}
	return this;
};

GUIEditor.prototype.deselect = function() {
	var selectedAttributes = $('.' + attributeContainerClass + ".selected");
	if (selectedAttributes.length > 0) {
		selectedAttributes.removeClass('selected');
		return this;
	}
	$("." + xmlElementClass + ".selected").removeClass("selected");
	this.selectedElement = null;
	if (this.editor.modifyMenu != null)
		this.editor.modifyMenu.clearContextualMenus();
	return this;
};

GUIEditor.prototype.deleteSelected = function() {
	if (this.selectedElement == null)
		return this;
	var selectedAttribute = this.selectedElement.getSelectedAttribute();
	if (selectedAttribute.length > 0) {
		this.selectAttribute(true);
		var newSelection = selectedAttribute.prev('.' + attributeContainerClass);
		if (newSelection.length == 0)
			newSelection = selectedAttribute.next('.' + attributeContainerClass);
		newSelection.addClass("selected");
		
		var xmlAttribute = selectedAttribute.data("xmlAttribute");
		xmlAttribute.remove();
	} else {
		this.deleteElement(this.selectedElement);
	}
	return this;
};

GUIEditor.prototype.deleteElement = function(xmlElement) {
	var isSelected = xmlElement.isSelected();
	if (isSelected) {
		var afterDeleteSelection = xmlElement.guiElement.next("." + xmlElementClass);
		if (afterDeleteSelection.length == 0)
			afterDeleteSelection = xmlElement.guiElement.prev("." + xmlElementClass);
		if (afterDeleteSelection.length == 0)
			afterDeleteSelection = xmlElement.guiElement.parents("." + xmlElementClass).first();
		this.selectElement(afterDeleteSelection);
	}
	xmlElement.remove();
	this.editor.xmlState.documentChangedEvent();
	return this;
};

GUIEditor.prototype.moveSelected = function(up) {
	return this.moveElement(this.selectedElement, up);
};

GUIEditor.prototype.moveElement = function(xmlElement, up) {
	if (xmlElement == null)
		return this;
	var result = up? xmlElement.moveUp() : xmlElement.moveDown();
	if (result) {
		this.editor.xmlState.documentChangedEvent();
		xmlElement.focus();
	}
	return this;
};

GUIEditor.prototype.updateElementPosition = function(moved) {
	var movedElement = moved.data('xmlElement');
	
	var sibling = moved.prev('.' + xmlElementClass);
	if (sibling.length == 0) {
		sibling = moved.next('.' + xmlElementClass);
		movedElement.xmlNode.detach().insertBefore(sibling.data('xmlElement').xmlNode);
	} else {
		movedElement.xmlNode.detach().insertAfter(sibling.data('xmlElement').xmlNode);
	}
	this.selectElement(moved);
	this.editor.xmlState.documentChangedEvent();
};

GUIEditor.prototype.selectSibling = function(reverse) {
	var direction = reverse? 'prev' : 'next';
	if (this.selectedElement.guiElement.length > 0) {
		newSelection = this.selectedElement.guiElement[direction]("." + xmlElementClass);
		if (newSelection.length == 0 && !this.selectedElement.isTopLevel) {
			// If there is no next sibling but the parent has one, then go to parents sibling
			this.selectedElement.guiElement.parents("." + xmlElementClass).each(function(){
				newSelection = $(this)[direction]("." + xmlElementClass);
				if (newSelection.length > 0 || $(this).data("xmlElement").isTopLevel)
					return false;
			});
		}
	} else {
		if (!reverse)
			newSelection = $("." + xmlElementClass).first();
	}
	
	if (newSelection.length == 0)
		return this;
	this.selectElement(newSelection.first()).selectedElement.focus();
	return this;
};

GUIEditor.prototype.selectParent = function(reverse) {
	if (reverse)
		newSelection = this.selectedElement.guiElement.find("." + xmlElementClass);
	else newSelection = this.selectedElement.guiElement.parents("." + xmlElementClass);
	if (newSelection.length == 0)
		return this;
	this.selectElement(newSelection.first()).selectedElement.focus();
	return this;
};

GUIEditor.prototype.selectNext = function(reverse) {
	var newSelection = null;
	if (this.selectedElement == null) {
		if (!reverse)
			newSelection = $("." + xmlElementClass).first();
	} else {
		var found = false;
		var allElements = $("." + xmlElementClass + ":visible", this.xmlContent);
		
		if (reverse)
			allElements = $(allElements.get().reverse());
		
		var selectedElement = this.selectedElement;
		allElements.each(function(){
			if (found) {
				newSelection = $(this);
				return false;
			} else if (this.id == selectedElement.guiElementID) {
				found = true;
			}
		});
	}
	
	if (newSelection != null)
		this.selectElement(newSelection.first()).selectedElement.focus();
	return this;
};

GUIEditor.prototype.selectAttribute = function(reverse) {
	if (this.selectedElement == null) {
		return this;
	} else {
		var selectedAttribute = this.selectedElement.getSelectedAttribute();
		if (selectedAttribute.length > 0) {
			var newSelection = selectedAttribute[reverse? 'prev' : 'next']("." + attributeContainerClass);
			if (newSelection.length > 0) {
				$("." + attributeContainerClass + ".selected").removeClass("selected");
				newSelection.addClass("selected");
			}
		} else {
			selectedAttribute = this.selectedElement.attributeContainer.children("." + attributeContainerClass)
					.first().addClass("selected");
		}
	}
};

GUIEditor.prototype.focusSelectedText = function() {
	if (this.selectedElement == null)
		return this;
	var focused = null;
	if (this.selectedElement.textInput != null) {
		focused = this.selectedElement.textInput.focus();
	} else {
		focused = this.selectedElement.guiElement.find("input[type=text].element_text:visible, textarea.element_text:visible, select.element_text:visible").first().focus();
	}
	if (focused == null || focused.length == 0)
		return this;
	// If the focused input was in an element other than the selected one, then select it
	var containerElement = focused.parents("." + xmlElementClass);
	if (containerElement !== this.selectedElement)
		this.selectElement(containerElement);
	return this;
};

GUIEditor.prototype.focusInput = function(reverse) {
	var focused = $("input:focus, textarea:focus, select:focus");
	if (focused.length == 0 && this.selectedElement == null) {
		if (reverse)
			return this;
		// Nothing is selected or focused, so grab the first available input
		focused = this.xmlContent.find("input[type=text]:visible, textarea:visible, select:visible").first().focus();
	} else {
		// When an input is already focused, tabbing selects the next input
		var foundFocus = false;
		var inputsSelector = "input[type=text]:visible, textarea:visible, select:visible";
		// If no inputs are focused but an element is selected, seek the next input near this element
		if (this.selectedElement != null && focused.length == 0) {
			inputsSelector += ", ." + xmlElementClass;
			focused = this.selectedElement.guiElement;
		}
		var visibleInputs = this.xmlContent.find(inputsSelector);
		// If in reverse mode, get the previous input
		if (reverse) {
			visibleInputs = $(visibleInputs.get().reverse());
		}
		// Seek the next input after the focused one
		visibleInputs.each(function(){
			// Can't focus a xml class if they are present.
			if (foundFocus && !$(this).hasClass(xmlElementClass)) {
				focused = $(this).focus();
				return false;
			} else if (this.id == focused.attr('id')) {
				foundFocus = true;
			}
		});
	}
	// If the focused input was in an element other than the selected one, then select it
	var containerElement = focused.parents("." + xmlElementClass);
	if (containerElement !== this.selectedElement)
		this.selectElement(containerElement);
	var container = focused.parents('.' + attributeContainerClass);
	if (container.length > 0)
		container.addClass('selected');
	return this;
};

GUIEditor.prototype.isCompletelyOnScreen = function(object) {
	var objectTop = object.offset().top;
	var objectBottom = objectTop + object.height();
	var docViewTop = $(window).scrollTop() + this.editor.editorHeader.height();
    var docViewBottom = docViewTop + $(window).height() - this.editor.editorHeader.height();
    
    return (docViewTop < objectTop) && (docViewBottom > objectBottom);
};

GUIEditor.prototype.focusObject = function(focusTarget) {
	if (!this.isCompletelyOnScreen(focusTarget)){
		var scrollHeight = focusTarget.offset().top + (focusTarget.height()/2) - ($(window).height()/2);
		if (scrollHeight > focusTarget.offset().top)
			scrollHeight = focusTarget.offset().top;
		scrollHeight -= this.editor.editorHeader.height();
		$("html, body").stop().animate({ scrollTop: scrollHeight }, 500);
	}
};
/**
 * Header MenuBar object
 */

function MenuBar(editor) {
	this.editor = editor;
	this.menuBarContainer = null;
	this.parentElement = null;
	this.updateFunctions = [];
	
	var self = this;
	this.headerMenuData = [ {
		label : 'File',
		enabled : true,
		action : function(event) {self.activateMenu(event);}, 
		items : [ {
				label : 'Submit to Server',
				enabled : (self.editor.options.ajaxOptions.xmlUploadPath != null),
				binding : "alt+shift+s",
				action : $.proxy(self.editor.submitXML, self.editor)
			}, {
				label : 'Export',
				enabled : (typeof(Blob) !== undefined),
				binding : "alt+shift+e",
				action : $.proxy(self.editor.exportXML, self.editor)
			} ]
	}, {
		label : 'Edit',
		enabled : true,
		action : function(event) {self.activateMenu(event);},
		items : [ {
			label : 'Undo',
			enabled : false,
			binding : "ctrl+z or mac+z",
			action : function() {
				self.editor.undoHistory.changeHead(-1);
			}
		}, {
			label : 'Redo',
			enabled : false,
			binding : "ctrl+y or mac+shift+z",
			action : function() {
				self.editor.undoHistory.changeHead(1);
			}
		}, {
			label : 'Delete',
			enabled : true,
			binding : "del",
			action : function(){
				self.editor.guiEditor.deleteSelected();
			}
		}, {
			label : 'Move Element Up',
			enabled : true,
			binding : "alt+up",
			action : function(){
				self.editor.guiEditor.moveSelected(true);
			}
		}, {
			label : 'Move Element Down',
			enabled : true,
			binding : "alt+down",
			action : function(){
				self.editor.guiEditor.moveSelected();
			}
		} ]
	}, {
		label : 'Select',
		enabled : true,
		action : function(event) {self.activateMenu(event);}, 
		items : [ {
				label : 'Deselect',
				enabled : true,
				binding : "esc",
				action : function(){
					self.editor.guiEditor.deselect();
				}
			},{
				label : 'Next Element',
				enabled : true,
				binding : "down",
				action : function(){
					self.editor.guiEditor.selectNext();
				}
			}, {
				label : 'Previous Element',
				enabled : true,
				binding : "up",
				action : function(){
					self.editor.guiEditor.selectNext(true);
				}
			}, {
				label : 'Next Attribute',
				enabled : true,
				binding : "right",
				action : function(){
					self.editor.guiEditor.selectAttribute();
				}
			}, {
				label : 'Previous Attribute',
				enabled : true,
				binding : "left",
				action : function(){
					self.editor.guiEditor.selectAttribute(true);
				}
			}, {
				label : 'Parent',
				enabled : true,
				binding : "shift+left",
				action : function(){
					self.editor.guiEditor.selectParent();
				}
			}, {
				label : 'First Child',
				enabled : true,
				binding : "shift+right",
				action : function(){
					self.editor.guiEditor.selectParent(true);
				}
			}, {
				label : 'Next Sibling',
				enabled : true,
				binding : "shift+down",
				action : function(){
					self.editor.guiEditor.selectSibling();
				}
			}, {
				label : 'Previous Sibling',
				enabled : true,
				binding : "shift+up",
				action : function(){
					self.editor.guiEditor.selectSibling(true);
				}
			} ]
	}, {
		label : 'View',
		enabled : true,
		action : function(event) {self.activateMenu(event);}, 
		items : [ {
			label : 'Switch to XML View',
			enabled : true,
			binding : "alt+shift+x",
			action : function() {
				self.editor.modeChange(0);
			}
		}, {
			label : 'Switch to Text View',
			enabled : true,
			binding : "alt+shift+t",
			action : function() {
				self.editor.modeChange(1);
			}
		} ]
	}, {
		label : 'Help',
		enabled : true,
		action : function(event) {self.activateMenu(event);}/*, 
		items : [ {
			label : 'MODS Outline of Elements',
			enabled : true,
			binding : null,
			action : "http://www.loc.gov/standards/mods/mods-outline.html"
		} ]*/
	}, {
		label : 'XML',
		enabled : true, 
		itemClass : 'header_mode_tab',
		action : function() {
			self.editor.modeChange(0);
		}
	}, {
		label : 'Text',
		enabled : true, 
		itemClass : 'header_mode_tab',
		action : function() {
			self.editor.modeChange(1);
		}
	} ];
}

MenuBar.prototype.activateMenu = function(event) {
	if (this.menuBarContainer.hasClass("active")) {
		this.menuBarContainer.removeClass("active");
		return;
	}
	var self = this;
	$.each(this.updateFunctions, function() {
		this(self.editor);
	});
	this.menuBarContainer.addClass("active");
	this.menuBarContainer.children("ul").children("li").click(function (event) {
		event.stopPropagation();
	});
	$('html').one("click" ,function() {
		self.menuBarContainer.removeClass("active");
	});
	event.stopPropagation();
};

MenuBar.prototype.render = function(parentElement) {
	this.parentElement = parentElement;
	this.menuBarContainer = $("<div/>").attr('class', xmlMenuBarClass).appendTo(parentElement);
	
	this.headerMenu = $("<ul/>");
	this.menuBarContainer.append(this.headerMenu);
	
	var menuBar = this;
	$.each(this.headerMenuData, function() {
		menuBar.generateMenuItem(this, menuBar.headerMenu);
	});
};

MenuBar.prototype.generateMenuItem = function(menuItemData, parentMenu) {
	var menuItem = $("<li/>").appendTo(parentMenu);
	var menuItemLink = $("<a/>").appendTo(menuItem).html("<span>" + menuItemData.label + "</span>");
	if (menuItemData.binding) {
		menuItemLink.append("<span class='binding'>" + menuItemData.binding + "</span>");
	}
	if (menuItemData.action != null) {
		if (Object.prototype.toString.call(menuItemData.action) == '[object Function]'){
			menuItem.click(menuItemData.action);
		} else {
			menuItemLink.attr({"href": menuItemData.action, "target" : "_blank"});
		}
	}
	if (!menuItemData.enabled) {
		menuItem.addClass("disabled");
	}
	if (menuItemData.itemClass) {
		menuItem.addClass(menuItemData.itemClass);
	}
	
	var menuBar = this;
	menuItem.data("menuItemData", menuItemData).attr("id", xmlMenuHeaderPrefix + menuItemData.label.replace(/ /g, "_"));
	if (menuItemData.items !== undefined && menuItemData.items.length > 0) {
		var subMenu = $("<ul/>").addClass('sub_menu').appendTo(menuItem);
		$.each(menuItemData.items, function() {
			menuBar.generateMenuItem(this, subMenu);
		});
	}
};

MenuBar.prototype.addEntry = function(entry) {
	var currentTier = this.headerMenuData;
	if (entry.insertPath) {
		$.each(entry.insertPath, function() {
			var pathLabel = this;
			$.each(currentTier, function() {
				if (this.label == pathLabel) {
					currentTier = this.items;
					return false;
				}
			});
		});
	}
	if (currentTier) {
		delete entry.insertPath;
		currentTier.push(entry);
	}
};
/**
 * Menu object for adding new elements to an existing element or document
 * @param menuID
 * @param label
 * @param expanded
 * @param enabled
 * @returns
 */

function ModifyElementMenu(menuID, label, expanded, enabled, owner) {
	this.menuID = menuID;
	this.label = label;
	this.menuHeader = null;
	this.menuContent = null;
	this.enabled = enabled;
	this.expanded = expanded;
	this.target = null;
	this.owner = owner;
}

ModifyElementMenu.prototype.destroy = function() {
	if (this.menuHeader != null)
		this.menuHeader.remove();
	if (this.menuContent != null)
		this.menuContent.remove();
};

ModifyElementMenu.prototype.render = function(parentContainer) {
	this.menuHeader = $("<div class='" + menuHeaderClass + "'/>").appendTo(parentContainer);
	if (this.expanded) {
		this.menuHeader.html(this.label + " <span>&#9660;</span>");
	} else {
		this.menuHeader.html(this.label + " <span>&#9654;</span>");
	}
	
	if (!this.enabled)
		this.menuHeader.addClass("disabled");
	
	this.menuContent = $("<ul id='" + this.menuID + "' class='" + menuContentClass + "'/>").data('menuData', this).appendTo(parentContainer);
	var self = this;
	this.menuHeader.click(function(){
		if (!self.enabled) {
			return;
		}
		
		if (self.expanded) {
			self.menuContent.animate({height: 'hide'}, menuExpandDuration, null, function(){
				self.menuContent.hide();
			});
			self.menuHeader.html(self.label + " <span>&#9654;</span>");
			self.expanded = false;
		} else {
			self.menuContent.show();
			self.menuContent.animate({height: 'show'}, menuExpandDuration);
			self.menuHeader.html(self.label + " <span>&#9660;</span>");
			self.expanded = true;
		}
	});
	return this;
};

ModifyElementMenu.prototype.initEventHandlers = function() {
	var self = this;
	this.menuContent.on('click', 'li', function(event){
		self.owner.editor.addChildElementCallback(this);
	});
};

ModifyElementMenu.prototype.clear = function() {
	var startingHeight = this.menuContent.height();
	this.menuContent.empty();
	this.menuContent.css({height: startingHeight + "px"}).stop().animate({height: "0px"}, menuExpandDuration);
	this.target = null;
	this.enabled = false;
	this.menuHeader.addClass('disabled');
	return this;
};

ModifyElementMenu.prototype.populate = function(xmlElement) {
	if (xmlElement == null || (this.target != null && xmlElement.guiElement != null 
			&& this.target[0] === xmlElement.guiElement[0]))
		return;
	
	if (this.expanded)
		this.menuContent.css("height", "auto");
	var startingHeight = this.menuContent.outerHeight();
	this.menuContent.empty();
	
	this.target = xmlElement;
	self = this;
	
	$.each(this.target.objectType.elements, function(){
		var xmlElement = this;
		$("<li/>").attr({
			title : 'Add ' + xmlElement.name
		}).html(xmlElement.name)
		.data('xml', {
				//"target": xmlElement,
				"target": self.target,
				"objectType": xmlElement
		}).appendTo(self.menuContent);
	});
	if (this.expanded) {
		var endingHeight = this.menuContent.outerHeight() + 1;
		if (endingHeight == 0)
			endingHeight = 1;
		this.menuContent.css({height: startingHeight + "px"}).stop().animate({height: endingHeight + "px"}, menuExpandDuration).show();
	}

	if (this.menuContent.children().length == 0) {
		this.menuHeader.addClass("disabled");
		this.enabled = false;
	} else {
		this.menuHeader.removeClass("disabled");
		this.enabled = true;
	}
	return this;
};
/**
 * Menu panel for managing individual modification menus.
 */

function ModifyMenuPanel(editor) {
	this.editor = editor;
	this.menus = {};
	this.menuColumn = null;
	this.menuContainer = null;
	
}

ModifyMenuPanel.prototype.initialize = function (parentContainer) {
	this.menuColumn = $("<div/>").attr('class', menuColumnClass).appendTo(parentContainer);
	$("<span/>").attr('class', submissionStatusClass).html("Document is unchanged").appendTo(this.menuColumn);
	
	var submitButton = $("<input/>").attr({
		'id' : submitButtonClass,
		'type' : 'button',
		'class' : 'send_xml',
		'name' : 'submit',
		'value' : 'Submit Changes'
	}).appendTo(this.menuColumn);
	if (this.editor.options.ajaxOptions.xmlUploadPath == null) {
		if (typeof(Blob) !== undefined){
			submitButton.attr("value", "Export");
		} else {
			submitButton.attr("disabled", "disabled");
		}
	}
	
	this.menuContainer = $("<div class='" + menuContainerClass + "'/>").appendTo(this.menuColumn);
	this.menuContainer.css({'max-height': $(window).height(), 'overflow-y': 'auto'});
	return this;
};

ModifyMenuPanel.prototype.addMenu = function(menuID, label, expanded, enabled, contextual) {
	if (arguments.length == 4)
		contextual = false;
	var menu = new ModifyElementMenu(menuID, label, expanded, enabled, this);
	this.menus[menuID] = {
			"menu" : menu, 
			"contextual": contextual
		};
	menu.render(this.menuContainer);
	menu.initEventHandlers();
	return menu;
};

ModifyMenuPanel.prototype.addAttributeMenu = function(menuID, label, expanded, enabled, contextual) {
	if (arguments.length == 4)
		contextual = false;
	var menu = new AttributeMenu(menuID, label, expanded, enabled, this);
	this.menus[menuID] = {
			"menu" : menu, 
			"contextual": contextual
		};
	menu.render(this.menuContainer);
	menu.initEventHandlers();
	return menu;
};

ModifyMenuPanel.prototype.clearContextualMenus = function() {
	$.each(this.menus, function(){
		if (this.contextual) {
			this.menu.clear();
		}
	});
	this.setMenuPosition();
	return this;
};

ModifyMenuPanel.prototype.refreshContextualMenus = function(targetElement) {
	$.each(this.menus, function(){
		if (this.contextual) {
			this.menu.populate(targetElement);
		}
	});
	this.setMenuPosition();
	return this;
};

ModifyMenuPanel.prototype.setMenuPosition = function(){
	if (this.menuColumn == null || this.menuColumn.offset() == null)
		return;
	
	var xmlWorkAreaContainer = this.editor.xmlWorkAreaContainer;
	var xmlEditorContainer = this.editor.xmlEditorContainer;
	var menuTop = xmlWorkAreaContainer.offset().top;
	if ($(window).scrollTop() >= menuTop) {
		this.menuColumn.css({
			position : 'fixed',
			left : xmlEditorContainer.offset().left + xmlEditorContainer.outerWidth() - this.menuColumn.outerWidth(),
			top : 0
		});
		this.editor.editorHeader.css({
			position : (this.editor.guiEditor.active)? 'fixed' : 'absolute',
			top : (this.editor.guiEditor.active)? 0 : menuTop
		});
	} else {
		this.menuColumn.css({
			position : 'absolute',
			left : xmlEditorContainer.offset().left + xmlEditorContainer.outerWidth() - this.menuColumn.outerWidth(),
			top : menuTop
		});
		this.editor.editorHeader.css({
			position : 'absolute',
			top : menuTop
		});
	}
	
	// Adjust the menu's height so that it doesn't run out of the editor container
	
	// Gap between the top of the column and the beginning of the actual menu
	var menuOffset = this.menuContainer.offset().top - this.menuColumn.offset().top;
	// Default height matches the height of the work area
	var menuHeight = xmlWorkAreaContainer.height() - menuOffset;
	
	var workAreaOffset = this.menuColumn.offset().top - $(window).scrollTop();
	if (workAreaOffset < 0)
		workAreaOffset = 0;
	// Prevent menu from exceeding window height
	if (menuHeight + menuOffset > $(window).height()) {
		menuHeight = $(window).height() - menuOffset;
	}
	
	// Prevent menu from exceeding editor height
	if (menuHeight + menuOffset > xmlWorkAreaContainer.height() + xmlWorkAreaContainer.offset().top - $(window).scrollTop()) {
		menuHeight = xmlWorkAreaContainer.height() + xmlWorkAreaContainer.offset().top - $(window).scrollTop() - menuOffset;
	}
	this.menuContainer.css({'max-height': menuHeight});
	return this;
};
function NamespaceList(namespaceList) {
	this.namespaceURIs = {};
	this.namespaceToPrefix = {};
	
	if (namespaceList) {
		$.extend({}, namespaceList);
		var self = this;
		$.each(this.namespaces, function() {
			self.namespaceToPrefix[value] = key;
		});
	}
}

NamespaceList.prototype.addNamespace = function(nsURI, nsPrefix) {
	this.namespaceURIs[nsPrefix] = nsURI;
	this.namespaceToPrefix[nsURI] = nsPrefix;
};

NamespaceList.prototype.containsURI = function(nsURI) {
	return nsURI in this.namespaceToPrefix;
};

NamespaceList.prototype.containsPrefix = function(namespacePrefix) {
	return nsPrefix in this.namespaceURIs;
};

NamespaceList.prototype.getNamespacePrefix = function(nsURI) {
	var prefix = this.namespaceToPrefix[nsURI];
	if (prefix)
		prefix += ":";
	return prefix;
};
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

TextEditor.prototype.inSelectedTag = function(row, startColumn, endColumn) {
	return !this.editor.xmlState.changesNotSynced() && row == this.selectedTagRange.row 
		&& startColumn == this.selectedTagRange.startColumn 
		&& endColumn == this.selectedTagRange.endColumn;
};


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

TextEditor.prototype.tagOccurrences = function(string, tagTitle) {
	if (string == null || tagTitle == null)
		return 0;
	var matches = string.match(new RegExp("<" + tagTitle + "( |>|$)", "g"));
	return matches ? matches.length : 0;
};

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
		// Get the schema's namespace prefix for the namespace of the node from the document
		// Determine what namespace is bound in the document to the prefix on this node
		var documentNS = this.editor.xmlState.namespaces.namespaceURIs[nsPrefix];
		// Determine what prefix is used for that namespace in the schema tree
		var schemaPrefix = this.editor.xmlTree.namespaces.getNamespacePrefix(documentNS);
		var prefixedTitle = schemaPrefix + unprefixedTitle; 
		
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
		var elementNode = $("*", this.editor.xmlState.xml).filter(function() {
	        return self.editor.nsEquals(this, unprefixedTitle, documentNS);
	      })[instanceNumber];
		if (elementNode == null)
			return this;
		
		// Retrieve the schema definition for the selected node
		var elementDef = this.editor.xmlTree.getElementDefinition(elementNode);
		// Clear the menu if there was no definition or it was the root node
		// TODO root nodes shouldn't be treated specially if they have a definition
		if (elementDef == null || elementDef === this.editor.xmlTree.rootElement) {
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

TextEditor.prototype.addElementEvent = function(parentElement, newElement) {
	this.reload();
	// Move cursor to the newly added element
	var instanceNumber = 0;
	this.editor.xmlState.xml.find(newElement.xmlNode[0].localName).each(function() {
		if (this === newElement.xmlNode.get(0)) {
			return false;
		}
		instanceNumber++;
	});
	var Range = require("ace/range").Range;
	var startPosition = new Range(0,0,0,0);
	var pattern = new RegExp("<(" + this.editor.options.targetPrefix + ":)?" + newElement.xmlNode[0].localName +"(\\s|\\/|>|$)", "g");
	this.aceEditor.find(pattern, {'regExp': true, 'start': startPosition, 'wrap': false});
	for (var i = 0; i < instanceNumber; i++) {
		this.aceEditor.findNext({'needle' : pattern});
	}
	this.aceEditor.clearSelection();
	this.aceEditor.selection.moveCursorBy(0, -1 * newElement.xmlNode[0].localName.length);

	this.editor.xmlState.syncedChangeEvent();
};

TextEditor.prototype.addAttributeEvent = function() {
	this.reload();
	this.editor.xmlState.syncedChangeEvent();
};
/**
 * Manages the history of changes that have occurred.
 */

function UndoHistory(editor) {
	this.states = [];
	this.headIndex = -1;
	this.stateChangeEvent = null;
	this.stateCaptureEvent = null;
	this.editor = editor;
}

UndoHistory.prototype.setStateChangeEvent = function(event) {
	this.stateChangeEvent = event;
	return this;
};

UndoHistory.prototype.setStateCaptureEvent = function(event) {
	this.stateCaptureEvent = event;
	return this;
};

UndoHistory.prototype.cloneNewDocument = function(originalDoc) {
	var newDoc = originalDoc.implementation.createDocument(
		originalDoc.namespaceURI, null, null
	);
	var newNode = newDoc.importNode(originalDoc.documentElement, true);
	newDoc.appendChild(newNode);
	return $(newDoc);
};

UndoHistory.prototype.changeHead = function(step){
	console.profile();
	if ((step < 0 && this.headIndex + step < 0) 
			|| (step > 0 && this.headIndex + step >= this.states.length
			||  this.headIndex + step >= this.editor.options.undoHistorySize))
		return;
	
	this.headIndex += step;
	this.editor.xmlState.xml = this.cloneNewDocument(this.states[this.headIndex][0]);
	
	this.editor.refreshDisplay();
	
	if (this.stateChangeEvent != null)
		this.stateChangeEvent(this);
	console.profileEnd();
};

UndoHistory.prototype.captureSnapshot = function () {
	if (this.editor.options.undoHistorySize <= 0)
		return;
	
	if (this.headIndex < this.states.length - 1) {
		this.states = this.states.slice(0, this.headIndex + 1);
	}
	
	if (this.states.length >= this.editor.options.undoHistorySize) {
		this.states = this.states.slice(1, this.states.length);
	}

	this.headIndex = this.states.length;

	this.states.push(this.cloneNewDocument(this.editor.xmlState.xml[0]));
	
	if (this.stateCaptureEvent != null)
		this.stateCaptureEvent(this);
};
/**
 * Stores data representing a single attribute for an element
 */

function XMLAttribute(objectType, xmlElement, editor) {
	AbstractXMLObject.call(this, editor, objectType);
	this.xmlElement = xmlElement;
	this.attributeID = null;
	this.attributeInput = null;
	this.attributeContainer = null;
	this.addButton = null;
}

XMLAttribute.prototype.constructor = XMLAttribute;
XMLAttribute.prototype = Object.create( AbstractXMLObject.prototype );

XMLAttribute.prototype.getDomElement = function () {
	return this.attributeContainer;
};

XMLAttribute.prototype.render = function (){
	this.attributeID = this.xmlElement.guiElementID + "_" + this.objectType.nameEsc;
	
	this.attributeContainer = $("<div/>").attr({
		'id' : this.attributeID + "_cont",
		'class' : attributeContainerClass
	}).data('xmlAttribute', this).appendTo(this.xmlElement.getAttributeContainer());
	
	var self = this;
	var removeButton = document.createElement('a');
	removeButton.appendChild(document.createTextNode('(x) '));
	this.attributeContainer[0].appendChild(removeButton);
	
	var label = document.createElement('label');
	label.appendChild(document.createTextNode(this.objectType.name));
	this.attributeContainer[0].appendChild(label);
	
	var attributeValue = this.xmlElement.xmlNode.attr(this.objectType.name);
	if (attributeValue == '' && this.objectType.defaultValue != null) {
		attributeValue = this.objectType.defaultValue;
	}
	
	this.attributeInput = this.createElementInput(this.attributeID.replace(":", "-"), attributeValue, this.attributeContainer[0]);
	this.attributeInput.data('xmlAttribute', this);
	
	return this.attributeInput;
};

XMLAttribute.prototype.remove = function() {
	if ($("#" + this.attributeID).length > 0) {
		if (this.addButton != null){
			this.addButton.removeClass("disabled");
		}
	}
	this.xmlElement.removeAttribute(this.objectType);
	this.attributeContainer.remove();
	this.xmlElement.updated();
	this.editor.xmlState.documentChangedEvent();
};

XMLAttribute.prototype.syncValue = function() {
	this.xmlElement.xmlNode.attr(this.objectType.name, this.attributeInput.val());
};

XMLAttribute.prototype.changeValue = function(value) {
	this.xmlElement.xmlNode.attr(this.objectType.name, value);
};

XMLAttribute.prototype.select = function() {
	this.editor.guiEditor.selectElement(self.xmlElement);
	this.attributeContainer.addClass('selected');
};

XMLAttribute.prototype.deselect = function() {
	this.attributeContainer.removeClass('selected');
};
/**
 * Stores data related to a single xml element as it is represented in both the base XML 
 * document and GUI
 */

function XMLElement(xmlNode, objectType, editor) {
	AbstractXMLObject.call(this, editor, objectType);
	this.xmlNode = $(xmlNode);
	this.isTopLevel = this.xmlNode[0].parentNode.parentNode === this.xmlNode[0].ownerDocument;
	this.allowChildren = this.objectType.elements.length > 0;
	this.allowAttributes = this.objectType.attributes != null && this.objectType.attributes.length > 0;
	this.allowText = this.objectType.type != null;
	this.guiElementID = null;
	this.guiElement = null;
	this.parentElement = null;
	this.textInput = null;
	this.elementHeader = null;
	this.childContainer = null;
	this.childCount = 0;
	this.attributeContainer = null;
	this.attributeCount = 0;
}

XMLElement.prototype.constructor = XMLElement;
XMLElement.prototype = Object.create( AbstractXMLObject.prototype );

XMLElement.prototype.getDomElement = function () {
	return this.guiElement;
};

XMLElement.prototype.render = function(parentElement, recursive) {
	this.parentElement = parentElement;
	this.guiElementID = this.guiEditor.nextIndex();
	
	// Create the element and add it to the container
	this.guiElement = document.createElement('div');
	this.guiElement.id = this.guiElementID;
	this.guiElement.className = this.objectType.nameEsc + 'Instance ' + xmlElementClass;
	if (this.isTopLevel)
		this.guiElement.className += ' ' + topLevelContainerClass;
	this.parentElement.childContainer[0].appendChild(this.guiElement);
	
	// Begin building contents
	this.elementHeader = document.createElement('ul');
	this.elementHeader.className = 'element_header';
	this.guiElement.appendChild(this.elementHeader);
	var elementNameContainer = document.createElement('li');
	elementNameContainer.className = 'element_name';
	this.elementHeader.appendChild(elementNameContainer);

	// set up element title and entry field if appropriate
	var titleElement = document.createElement('span');
	titleElement.appendChild(document.createTextNode(this.objectType.name));
	elementNameContainer.appendChild(titleElement);
	
	// Switch gui element over to a jquery object
	this.guiElement = $(this.guiElement);
	this.guiElement.data("xmlElement", this);

	// Add the subsections for the elements content next.
	this.addContentContainers(recursive);

	// Action buttons
	this.elementHeader.appendChild(this.addTopActions(this.guiElementID));
	
	var self = this;
	
	this.initializeGUI();
	this.updated();
	
	return this.guiElement;
};

XMLElement.prototype.renderChildren = function(recursive) {
	this.childCount = 0;
	this.guiElement.children("." + xmlElementClass).remove();
	
	var elementsArray = this.objectType.elements;
	var self = this;
	this.xmlNode.children().each(function() {
		for ( var i = 0; i < elementsArray.length; i++) {
			if (self.editor.nsEquals(this, elementsArray[i])) {
				var childElement = new XMLElement($(this), elementsArray[i], self.editor);
				childElement.render(self, recursive);
				return;
			}
		}
	});
};

XMLElement.prototype.renderAttributes = function () {
	var self = this;
	var attributesArray = this.objectType.attributes;
	
	$(this.xmlNode[0].attributes).each(function() {
		for ( var i = 0; i < attributesArray.length; i++) {
			if (attributesArray[i].name == this.nodeName) {
				var attribute = new XMLAttribute(attributesArray[i], self, self.editor);
				attribute.render();
				return;
			}
		}
	});
};

XMLElement.prototype.initializeGUI = function () {
	var self = this;
	if (this.childContainer != null) {
		this.childContainer.sortable({
			distance: 10,
			items: '> .' + xmlElementClass,
			update: function(event, ui) {
				self.editor.guiEditor.updateElementPosition($(ui.item));
			}
		});
	}
};

XMLElement.prototype.addTopActions = function () {
	var self = this;
	var topActionSpan = document.createElement('li');
	topActionSpan.className = 'top_actions';
	
	var moveDown = document.createElement('span');
	moveDown.className = 'move_down';
	moveDown.id = this.guiElementID + '_down';
	moveDown.appendChild(document.createTextNode('\u2193'));
	topActionSpan.appendChild(moveDown);
	
	var moveUp = document.createElement('span');
	moveUp.className = 'move_up';
	moveUp.id = this.guiElementID + '_up';
	moveUp.appendChild(document.createTextNode('\u2191'));
	topActionSpan.appendChild(moveUp);
	
	var deleteButton = document.createElement('span');
	deleteButton.className = 'delete';
	deleteButton.id = this.guiElementID + '_del';
	deleteButton.appendChild(document.createTextNode('X'));
	topActionSpan.appendChild(deleteButton);
	
	return topActionSpan;
};

XMLElement.prototype.addContentContainers = function (recursive) {
	var attributesArray = this.objectType.attributes;
	var elementsArray = this.objectType.elements;
	
	var placeholder = document.createElement('div');
	placeholder.className = 'placeholder';
	if (attributesArray.length > 0){
		if (elementsArray.length > 0)
			placeholder.appendChild(document.createTextNode('Use the menu to add subelements and attributes.'));
		else
			placeholder.appendChild(document.createTextNode('Use the menu to add attributes.'));
	} else
		placeholder.appendChild(document.createTextNode('Use the menu to add subelements.'));
	this.placeholder = $(placeholder);
	this.guiElement.append(this.placeholder);
	
	if (attributesArray.length > 0) {
		this.addAttributeContainer();
	}
	
	if (this.objectType.type != null) {
		this.addTextContainer();
	}

	if (elementsArray.length > 0) {
		this.addSubelementContainer(recursive);
	}
};

XMLElement.prototype.addTextContainer = function () {
	var container = document.createElement('div');
	container.id = this.guiElementID + "_cont_text";
	container.className = 'content_block';
	this.guiElement.append(container);
	var textContainsChildren = this.xmlNode[0].children && this.xmlNode[0].children.length > 0;
	
	var textValue = "";
	if (textContainsChildren) {
		textValue = this.editor.xml2Str(this.xmlNode.children());
	} else {
		textValue = this.xmlNode.text();
	}
	
	this.textInput = this.createElementInput(this.guiElementID + "_text", 
			textValue, container);
	this.textInput.addClass('element_text');
	if (textContainsChildren)
		this.textInput.attr("disabled", "disabled");
	var self = this;
	this.textInput.change(function() {
		self.syncText();
		self.editor.xmlState.documentChangedEvent();
	});
};

XMLElement.prototype.addSubelementContainer = function (recursive) {
	var container = document.createElement('div');
	container.id = this.guiElementID + "_cont_elements";
	container.className = "content_block " + childrenContainerClass;
	this.guiElement[0].appendChild(container);
	this.childContainer = $(container);
	
	// Add all the subchildren
	if (recursive) {
		this.renderChildren(true);
	}
};

XMLElement.prototype.addAttributeContainer = function () {
	var container = document.createElement('div');
	container.id = this.guiElementID + "_cont_attributes";
	container.className = "content_block " + attributesContainerClass;
	this.guiElement[0].appendChild(container);
	this.attributeContainer = $(container);

	this.renderAttributes();
};

XMLElement.prototype.addElement = function(objectType) {
	if (!this.allowChildren)
		return null;
	
	var prefix = this.editor.xmlState.namespaces.getNamespacePrefix(objectType.namespace);
	
	// Create the new element in the target namespace with the matching prefix
	var newElement = this.editor.xmlState.xml[0].createElementNS(objectType.namespace, prefix + objectType.localName);
	newElement.appendChild(document.createTextNode(" "));
	this.xmlNode[0].appendChild(newElement);
	
	var childElement = new XMLElement(newElement, objectType, this.editor);
	this.childCount++;
	if (this.guiElement != null)
		childElement.render(this, true);
	
	this.updated();
	
	return childElement;
};

XMLElement.prototype.syncText = function() {
	if (this.xmlNode[0].childNodes.length > 0) {
		this.xmlNode[0].childNodes[0].nodeValue = this.textInput.val();
	} else {
		this.xmlNode[0].appendChild(document.createTextNode(this.textInput.val()));
	}
};

XMLElement.prototype.childRemoved = function(child) {
	this.updated();
};

XMLElement.prototype.attributeRemoved = function(child) {
	this.updated();
};

XMLElement.prototype.remove = function() {
	// Remove the element from the xml doc
	this.xmlNode.remove();
	
	if (this.guiElement != null) {
		this.guiElement.remove();
	}
	
	// Notify parent this object was removed
	if (this.parentElement != null) {
		this.parentElement.childRemoved(this);
	}
};

XMLElement.prototype.swap = function (swapTarget) {
	if (swapTarget == null) {
		return;
	}
	
	// Swap the xml nodes
	swapTarget.xmlNode.detach().insertAfter(this.xmlNode);
	if (swapTarget.guiElement != null && this.guiElement != null) {
		// Swap the gui nodes
		swapTarget.guiElement.detach().insertAfter(this.guiElement);
	}
};

XMLElement.prototype.moveUp = function() {
	var previousSibling = this.guiElement.prev("." + xmlElementClass);
	if (previousSibling.length > 0) {
		this.swap(previousSibling.data("xmlElement"));
		return true;
	} else {
		return false;
	}
};

XMLElement.prototype.moveDown = function() {
	var nextSibling = this.guiElement.next("." + xmlElementClass);
	if (nextSibling.length > 0) {
		nextSibling.data("xmlElement").swap(this);
		return true;
	} else {
		return false;
	}
};

XMLElement.prototype.addAttribute = function (objectType) {
	var attributeValue = "";
	if (objectType.defaultValue) {
		attributeValue = objectType.defaultValue;
	}
	this.xmlNode.attr(objectType.name, attributeValue);
	return attributeValue;
};

XMLElement.prototype.removeAttribute = function (objectType) {
	this.xmlNode[0].removeAttribute(objectType.name);
	this.updated();
};


XMLElement.prototype.getSelectedAttribute = function () {
	return this.attributeContainer.children(".selected");
};


XMLElement.prototype.updated = function () {
	if (this.guiElement == null)
		return;
	this.childCount = 0;
	this.attributeCount = 0;
	
	if (this.childContainer != null && this.objectType.elements) {
		this.childCount = this.childContainer[0].children.length;
		if (this.childCount > 0)
			this.childContainer.show();
		else this.childContainer.hide();
	}
	if (this.attributeContainer != null && this.objectType.attributes) {
		this.attributeCount = this.attributeContainer[0].children.length;
		if (this.attributeCount > 0)
			this.attributeContainer.show();
		else this.attributeContainer.hide();
	}
	
	if (!this.allowText && this.childCount == 0 && this.attributeCount == 0) {
		this.placeholder.show();
	} else {
		this.placeholder.hide();
	}
};

XMLElement.prototype.select = function() {
	this.guiElement.addClass("selected");
};

XMLElement.prototype.isSelected = function() {
	return this.guiElement.hasClass("selected");
};

XMLElement.prototype.getAttributeContainer = function() {
	return this.attributeContainer;
};

XMLElement.prototype.getChildContainer = function() {
	return this.childContainer;
};
})(jQuery);