//= require_self
//= require_tree .

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
		this.xmlState.namespaces.addToJQuery();
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
	
	getBlobBuilder: function() {
		return window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder;
	},
	
	exportXML: function() {
		window.URL = window.webkitURL || window.URL;
		window.BlobBuilder = this.getBlobBuilder();
		
		if (window.BlobBuilder === undefined) {
			this.addProblem("Browser does not support saving files via this editor.  To save, copy and paste the document from the Text view.");
			return false;
		}
		
		if (this.textEditor.active) {
			try {
				this.setXMLFromEditor();
			} catch (e) {
				this.xmlState.setDocumentHasChanged(true);
				$("." + submissionStatusClass).html("Failed to save<br/>See errors at top").css("background-color", "#ffbbbb").animate({backgroundColor: "#ffffff"}, 1000);
				this.addProblem("Cannot save due to invalid xml", e);
				return false;
			}
		}
		
		var xmlString = this.xml2Str(this.xmlState.xml);
		var blobBuilder = new BlobBuilder();
		blobBuilder.append(xmlString);
		
		var mimeType = "text/xml";
		
		var a = document.createElement('a');
		a.download = "xml.xml";
		a.href = window.URL.createObjectURL(blobBuilder.getBlob(mimeType));
		
		a.dataset.downloadurl = [mimeType, a.download, a.href].join(':');
		a.target = "exportXML";
		
		var event = document.createEvent("MouseEvents");
		event.initMouseEvent(
			"click", true, false, window, 0, 0, 0, 0, 0
			, false, false, false, false, 0, null
		);
		a.dispatchEvent(event);
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
