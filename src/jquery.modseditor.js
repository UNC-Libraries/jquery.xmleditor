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
 * jQuery MODS Editor
 * 
 * Dependencies:
 *   vkbeautify.0.98.01.beta.js
 *   jquery 1.7.1
 *   jquery.ui 1.7.1
 *   ajax ace editor
 *   jquery.xmlns.js
 *   expanding.js
 * 
 * @author Ben Pennell
 */
 
var menuContainerClass = "mods_menu_container";
var menuHeaderClass = "menu_header";
var menuColumnClass = "mods_menu_column";
var menuContentClass = 'menu_content';
var menuExpandDuration = 180;
var modsElementClass = 'mods_element';
var topLevelContainerClass = 'top_level_element_group';
var elementRootPrefix = "root_element_";
var elementPrefix = "mods_element_";
var childrenContainerSelector = " > .mods_children";
var childrenContainerClass = "mods_children";
var attributeContainerClass = "attribute_container";
var attributesContainerSelector = " > .mods_attrs";
var attributesContainerClass = "mods_attrs";
var modsMenuHeaderPrefix = "mods_header_item_";
var modsEditorContainerClass = "mods_editor_container";
var modsWorkAreaContainerClass = "mods_work_area";
var addTopMenuClass = "add_top_menu";
var addAttrMenuClass = "add_attribute_menu";
var addElementMenuClass = "add_element_menu";
var modsMenuBarClass = "mods_menu_bar";
var submitButtonClass = "send_xml";
var xmlTabClass = "mods_xml_content_tab";
var submissionStatusClass = "mods_submit_status";
var modsContentClass = "mods_content";

var editorTabAreaClass = "mods_tab_area";
var problemsPanelClass = "mods_problems_panel";
var guiContentClass = "gui_content";
var textContentClass = "text_content";
var editorHeaderClass = "mods_editor_header";

$.widget( "xml.modsEditor", {
	options: {
		addTopMenuHeaderText : 'Add Top Element',
		addAttrMenuHeaderText : 'Add Attribute',
		addElementMenuHeaderText : 'Add Subelement',
		xmlTabLabel : "XML",
		schemaObject: null,
		confirmExitWhenUnsubmitted : true,
		enableGUIKeybindings : true,
		floatingMenu : true,
		
		ajaxOptions : {
			modsUploadPath: null,
			modsRetrievalPath: null,
			modsRetrievalParams : null
		},
		localXMLContentSelector: this.element,
		prettyXML : true,
		undoHistorySize: 20,
		documentTitle : null,
		nameSpaces: {
			"mods" : "http://www.loc.gov/mods/v3"
		},
		submitResponseHandler : null,
		targetNS: "http://www.loc.gov/mods/v3",
		targetPrefix: "mods",
		menuEntries: undefined
	},
	
	_create: function() {
		this.instanceNumber = $("xml-modsEditor").length;
		
		// If the schema is a function, execute it to get the schema from it.
		if (jQuery.isFunction(this.options.schemaObject)) {
			this.schema = this.options.schemaObject.apply();
		} else {
			this.schema = JSON.retrocycle(this.options.schemaObject);
		}
		
		// Add namespaces into jquery
		$.each(this.options.nameSpaces, function (prefix, value) {
			$.xmlns[prefix] = value;
		});
		
		// Tree of MODS element types
		this.modsTree = null;
		// State of the XML document
		this.xmlState = null;
		// Container for the entire editor
		this.modsEditorContainer = null;
		// Container for the subeditors
		this.modsWorkAreaContainer = null;
		// Tabbed container for differentiating between specific subeditors
		this.modsTabContainer = null;
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
    },
 
    _init: function() {
    	if (this.options.submitResponseHandler == null)
    		this.options.submitResponseHandler = this.swordSubmitResponseHandler;
    	
    	this.modsTree = new SchemaTree(this.schema);
    	this.modsTree.build();
		
		// Retrieve the local mods content before we start populating the editor.
    	var localXMLContent = null;
		if ($(this.options.localXMLContentSelector).is("textarea")) {
			localXMLContent = $(this.options.localXMLContentSelector).val(); 
		} else {
			localXMLContent = this.element.html();
		}
		this.element.empty();
		
		this.xmlState = null;
		
		this.modsEditorContainer = $("<div/>").attr('class', modsEditorContainerClass).appendTo(this.element);
		this.modsWorkAreaContainer = null;
		this.modsTabContainer = null;
		
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
			$(window).bind('beforeunload', $.proxy(function(e) {
				if (this.xmlState.isChanged()) {
					return "The document contains unsaved changes.";
				}
			}, this));
		}
		
		if (this.options.ajaxOptions.modsRetrievalPath != null) {
			$.ajax({
				type : "GET",
				url : this.options.ajaxOptions.modsRetrievalPath,
				data : (this.options.ajaxOptions.modsRetrievalParams),
				dataType : "text",
				success : function(data) {
					self.loadDocument(data);
				}
			});
		} else {
			this.loadDocument(localXMLContent);
		}
	},
    
    loadDocument: function(xmlString) {
		this.xmlState = new DocumentState(xmlString, this);
		this.targetPrefix = this.xmlState.extractNamespacePrefix(this.options.targetNS);
		if (this.targetPrefix != "")
			this.targetPrefix += ":";
		this.constructEditor();
		this.refreshDisplay();
		// Capture baseline undo state
		this.undoHistory.captureSnapshot();
	},
	
	constructEditor: function() {
		// Work Area
		this.modsWorkAreaContainer = $("<div/>").attr('class', modsWorkAreaContainerClass).appendTo(this.modsEditorContainer);
		
		// Menu bar
		this.editorHeader = $("<div/>").attr('class', editorHeaderClass).appendTo(this.modsWorkAreaContainer);
		if (this.options.documentTitle != null)
			$("<h2/>").html("Editing Description: " + this.options.documentTitle).appendTo(this.editorHeader);
		this.menuBar.render(this.editorHeader);
		
		this.modsTabContainer = $("<div/>").attr("class", editorTabAreaClass).css("padding-top", this.editorHeader.height() + "px").appendTo(this.modsWorkAreaContainer);
		this.problemsPanel = $("<pre/>").attr('class', problemsPanelClass).hide().appendTo(this.modsTabContainer);
		
		this.guiEditor.initialize(this.modsTabContainer);
		this.modeChange(0);
		
		var self = this;
		$(window).resize(function() {
			self.modsTabContainer.width(self.modsEditorContainer.outerWidth() - self.modifyMenu.menuColumn.outerWidth());
			if (self.activeEditor != null){
				self.activeEditor.resize();
			}
			self.editorHeader.width(self.modsTabContainer.width());
			if (self.options.floatingMenu) {
				self.modifyMenu.setMenuPosition();
			}
		});
		
		this.modifyMenu.initialize(this.modsEditorContainer);
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
		var xmlElement = $(instigator).data("mods").target;
		var objectType = $(instigator).data("mods").objectType;
		
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
		var data = $(instigator).data('mods');
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
			$("#" + modsMenuHeaderPrefix + "MODS").addClass("active_mode_tab");
		} else {
			this.activeEditor = this.textEditor;
			$("#" + modsMenuHeaderPrefix + "XML").addClass("active_mode_tab");
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
		this.modsWorkAreaContainer.width(this.modsEditorContainer.outerWidth() - this.modifyMenu.menuColumn.outerWidth());
	},
	
	setXMLFromEditor: function() {
		var xmlString = this.textEditor.aceEditor.getValue();
		this.xmlState.setXMLFromString(xmlString);
	},
	
	saveXML: function() {
		if (this.options.ajaxOptions.modsUploadPath != null) {
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
			this.addProblem("Browser does not support saving files via this editor.  To save, copy and paste the document from the XML view.");
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
		a.download = "mods.xml";
		a.href = window.URL.createObjectURL(blobBuilder.getBlob(mimeType));
		
		a.dataset.downloadurl = [mimeType, a.download, a.href].join(':');
		a.target = "exportMODS";
		
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
			'url' : this.options.ajaxOptions.modsUploadPath,
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
					self.addProblem("Failed to submit MODS document", outcome);
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

	nsEquals: function(node, element) {
		return (((element.substring && element == node.localName) || (!element.substring && element.name == node.localName)) 
				&& node.namespaceURI == this.options.targetNS);
	},
	
	getXPath: function(element) {
	    var xpath = '';
	    for ( ; element && element.nodeType == 1; element = element.parentNode ) {
	        var id = $(element.parentNode).children(element.tagName.replace(":", "\\:")).index(element) + 1;
	        id = ('[' + id + ']');
	        if (element.tagName.indexOf("mods:") == -1)
	        	xpath = '/mods:' + element.tagName + id + xpath;
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
		
		if (e.altKey && e.shiftKey && e.keyCode == 'M'.charCodeAt(0)) {
			this.modsTabContainer.tabs('select', 0);
			return false;
		}
		
		if (e.altKey && e.shiftKey && e.keyCode == 'X'.charCodeAt(0)) {
			this.modsTabContainer.tabs('select', 1);
			return false;
		}
		
		return true;
	},
	
	/**
	 * Menu Update functions
	 */
	refreshMenuUndo: function(self) {
		if (self.undoHistory.headIndex > 0) {
			$("#" + modsMenuHeaderPrefix + "Undo").removeClass("disabled").data("menuItemData").enabled = true;
		} else {
			$("#" + modsMenuHeaderPrefix + "Undo").addClass("disabled").data("menuItemData").enabled = false;
		}
		if (self.undoHistory.headIndex < self.undoHistory.states.length - 1) {
			$("#" + modsMenuHeaderPrefix + "Redo").removeClass("disabled").data("menuItemData").enabled = true;
		} else {
			$("#" + modsMenuHeaderPrefix + "Redo").addClass("disabled").data("menuItemData").enabled = false;
		}
	},
	
	refreshMenuSelected: function(self) {
		var suffixes = ['Deselect', 'Next_Element', 'Previous_Element', 'Parent', 'First_Child', 'Next_Sibling', 
		                'Previous_Sibling', 'Next_Attribute', 'Previous_Attribute', 'Delete', 'Move_Element_Up', 
		                'Move_Element_Down'];
		var hasSelected = self.guiEditor.selectedElement != null && self.guiEditor.active;
		$.each(suffixes, function(){
			if (hasSelected)
				$("#" + modsMenuHeaderPrefix + this.toString()).removeClass("disabled").data("menuItemData").enabled = true;
			else $("#" + modsMenuHeaderPrefix + this.toString()).addClass("disabled").data("menuItemData").enabled = false;
		});
	}
});
