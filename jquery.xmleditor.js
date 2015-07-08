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
 *   jquery.ui 1.9+
 *   ajax ace editor
 *   jquery.autosize.js (optional)
 * 
 * @author Ben Pennell
 */
 
// Selector and class name constants
var menuContainerClass = "xml_menu_container";
var menuHeaderClass = "menu_header";
var menuColumnClass = "xml_menu_column";
var menuContentClass = 'menu_content';
var menuExpandDuration = 180;
var xmlElementClass = 'xml_element';
var xmlTextClass = 'xml_text_node';
var xmlNodeClass = 'xml_node';
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
var addNodeMenuClass = "add_node_menu";
var xmlMenuBarClass = "xml_menu_bar";
var submitButtonClass = "send_xml";
var submissionStatusClass = "xml_submit_status";
var xmlContentClass = "xml_content";

var editorTabAreaClass = "xml_tab_area";
var problemsPanelClass = "xml_problems_panel";
var guiContentClass = "gui_content";
var textContentClass = "text_content";
var editorHeaderClass = "xml_editor_header";

// Returns the local name of a node.  Needed for older versions of ie
var localName = function(node) {
	var localName = node.localName;
	if (localName) return localName;
	var index = node.nodeName.indexOf(':');
	if (index == -1) return node.nodeName;
	return node.nodeName.substring(index + 1);
};

$.widget( "xml.xmlEditor", {
	options: {
		// Schema object to be used
		schema: null,
		// Whether or not to attempt to load the schema in a worker thread, if available
		loadSchemaAsychronously: true,
		// Path to directory containing cycle.js, needed for loadSchemaAsychronously
		libPath: null,
		// Document retrieval and upload parameters
		ajaxOptions : {
			xmlUploadPath: null,
			xmlRetrievalPath: null,
			xmlRetrievalParams : null
		},

		// User set default template settings
		templatePath : false,
    	templates : [],
    	defaultTemplate : false,
		cancelTemplate : false,

		// Function triggered after uploading XML document, to interpret if the response was successful or not.  If upload failed, an error message should be returned.
		submitResponseHandler : null,
		// Function triggered after uploading XML document, if an error occurs. Gives full text of error, instead of a boilerplate "500 server error" message.
		submitErrorHandler : null,

		submitButtonConfigs : null,
		// Event function trigger after an xml element is update via the gui
		elementUpdated : undefined,
		// Title for the document, displayed in the header
		documentTitle : null,
		addTopMenuHeaderText : 'Add Top Element',
		addAttrMenuHeaderText : 'Add Attribute',
		addElementMenuHeaderText : 'Add Subelement',
		xmlEditorLabel : 'XML',
		textEditorLabel : 'Text',
		
		// Set to false to get rid of the 
		enableDocumentStatusPanel : true,
		documentStatusPanelDomId : "<div>",
		confirmExitWhenUnsubmitted : true,
		enableGUIKeybindings : true,
		floatingMenu : true,
		// Requires jquery.autosize, defaults to false if plugin isn't detected
		expandingTextAreas: true,
		
		// Pretty formatting of XML output.  Requires vkbeauty.js, defaults to false is not available
		prettyXML : true,
		// Number of history states held for the undo feature
		undoHistorySize: 20,
		// Object containing additional entries to add to the header menu
		menuEntries: undefined,
		enforceOccurs: false,
		prependNewElements: false,
		autocomplete: true,
		
		targetNS: null
	},
	
	_create: function() {
		var self = this;
		var schema = this.options.schema;
		var libPath = this.options.libPath;

		this.instanceNumber = $("xml-xmlEditor").length;
		
		// Tree of xml element types
		this.schemaTree = null;
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
		// Flag indicating if the editor was initialized on a text area that will need to be updated
		this.isTextAreaEditor = false;

		var url = document.location.href;
		var index = url.lastIndexOf("/");
		if (index != -1)
			this.baseUrl = url.substring(0, index + 1);
		
		// Detect optional features
		if (!$.isFunction($.fn.autosize))
			this.options.expandingTextAreas = false;
		
		if (typeof(this.options.schema) != 'function') {
			// Turn relative paths into absolute paths for the sake of web workers
			var path_regx = /^https?:\/\/.*?\//;
			var matches = this.baseUrl.match(path_regx);

			// Turn relative paths into absolute paths for the sake of web workers
			if (libPath) {
				// Check for trailing slash. Add if needed, otherwise libPath breaks
				libPath = (/\/$/.test(libPath)) ? libPath : libPath + '/';

				if (!path_regx.test(libPath)) {
					if (libPath.indexOf('/') === 0) {
						this.libPath = matches[0] + libPath.substr(1, libPath.length);
					} else {
						this.libPath = this.baseUrl + libPath;
					}
				} else  {
					this.libPath = libPath;
				}
			} else {
				this.libPath = this.baseUrl + "lib/";
			}

			if ((typeof schema == 'string' || typeof schema instanceof String)) {
				// if http(s) just return the schema untouched
				if (!path_regx.test(schema)) {
					if (schema.indexOf('/') === 0) {
						// Relative to root
						this.options.schema = matches[0] + schema.substr(1, schema.length);
					} else {
						// Relative to current path
						this.options.schema = this.baseUrl + schema;
					}
				}
			}
		}

		// Check for default templates if no default retrieval path
		if (!this.options.templatePath) {
			this.loadSchema(this.options.schema);
		} else if (this.options.ajaxOptions.xmlRetrievalPath === null) {
			this._templating(this);
		} else {
			this.loadSchema(this.options.schema);
		}
	},
 
	_init: function() {
		if (this.options.submitButtonConfigs) {
			// User provided button configuration
			this.submitButtonConfigs = this.options.submitButtonConfigs;
		} else {
			// Simple button configuration, generate defaults
			var exporting = !this.options.ajaxOptions.xmlUploadPath;

			// Either an upload button or an export button
			this.submitButtonConfigs = [{
				url : this.options.ajaxOptions.xmlUploadPath,
				label : exporting? "Export" : "Submit changes",
				onSubmit : exporting? this.exportXML : null,
				disabled : typeof(Blob) === undefined && exporting
			}];
		}

		if (this.options.submitErrorHandler == null) {
			this.options.submitErrorHandler = function(jqXHR, exception) {
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
			};
		}

		// Retrieve the local xml content before we start populating the editor.
		var localXMLContent = null;
		if (this.element.is("textarea")) {
			// Editor initialized on a text area.  Move text area out of the way and hide it
			// so that it can be updated with document changes.
			this.isTextAreaEditor = true;
			// Capture the existing value in the text area in case we are using a local document
			// Retrieving text instead of val because of firefox inconsistencies
			localXMLContent = this.element.text();
			this.xmlEditorContainer = $("<div/>").attr('class', xmlEditorContainerClass);
			$(this.element)
				.before(this.xmlEditorContainer)
				.hide();
		} else {
			if (this.element.children().length > 0) {
				// If the content is embedded as part of the html, retrieve it as such.
				// Note, this is case insensitive and can leave to problems
				localXMLContent = this.element.html();
			} else {
				// Content is probably XML encoded
				localXMLContent = this.element.text();
			}
			
			// Clear out the contents of the element being initialized on
			this.element.text("");
			
			// Add the editor into the dom
			this.xmlEditorContainer = $("<div/>").attr('class', xmlEditorContainerClass).appendTo(this.element);
		}
		this.xmlState = null;
		this.xmlWorkAreaContainer = null;
		this.xmlTabContainer = null;
		
		this.editorHeader = null;
		this.problemsPanel = null;
		
		this.guiEditor = new GUIEditor(this);
		this.textEditor = new TextEditor(this);
		this.activeEditor = this.guiEditor;
		
		var self = this;
		
		this.menuBar = new MenuBar(this);
		this.menuBar.updateFunctions.push(this.refreshMenuUndo);
		this.menuBar.updateFunctions.push(this.refreshMenuSelected);
		if (this.options.menuEntries) {
			$.each(this.options.menuEntries, function() {
				self.menuBar.addEntry(this);
			});
		}
		this.modifyMenu = new ModifyMenuPanel(this);
		
		if (this.options.confirmExitWhenUnsubmitted) {
			$(window).bind('beforeunload', function(e) {
				if (self.xmlState != null && self.xmlState.isChanged()) {
					return "The document contains unsaved changes.";
				}
			});
		}
		
		this.loadDocument(this.options.ajaxOptions, localXMLContent);
	},
	
	// Load the schema object
	loadSchema: function(schema) {
		var self = this;
		// If the schema is a function, execute it to get the schema from it.
		if (jQuery.isFunction(schema)) {
			this.schema = schema.apply();
			self._schemaReady();
		} else {
			// Load schema in separate thread for browsers tha support it.  IE10 blocked to avoid security error
			if (this.options.loadSchemaAsychronously && !window.MSBlobBuilder
					&& typeof(window.URL) !== "undefined" && typeof(Worker) !== "undefined" && typeof(Blob) !== "undefined") {
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
					self.schema = JSON.retrocycle(schema);
					self._schemaReady();
				};
				worker.postMessage({'schema' : schema, 'libPath' : this.libPath});
			} else {
				// Fallback with synchronous retrocycling
				if (typeof schema == 'string' || typeof schema instanceof String) {
					$.ajax({
						url : schema,
						async : self.options.loadSchemaAsynchronously,
						dataType : 'json',
						success : function(data) {
							self.schema = JSON.retrocycle(data);
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
	
	// Load the XML document for editing
	loadDocument: function(ajaxOptions, localXMLContent) {
		if (ajaxOptions != null && ajaxOptions.xmlRetrievalPath != null) {
			var self = this;
			$.ajax({
				type : "GET",
				url : ajaxOptions.xmlRetrievalPath,
				data : (ajaxOptions.xmlRetrievalParams),
				dataType : "text",
				success : function(data) {
					if (!self.options.templatePath || $(data).children().length) {
						self._documentReady(data);
					} else {
						// Check for templates if XML retrieval path is set.
						self._templating(self);
					}
				}
			});
		} else {
			this._documentReady(localXMLContent);
		}
	},

	_templating : function(self) {
		self.template = new XMLTemplates(self);

		if (self.options.defaultTemplate) {
			self.template.loadSelectedTemplate(self.options.defaultTemplate, self);
		} else {
			self.template.templateForm();
			self.template.createDialog();
		}
	},

	// XML Document loaded event
	_documentReady : function(xmlString) {
		var self = this;

		this.xmlState = new DocumentState(xmlString, this);
		this.xmlState.extractNamespacePrefixes();
		this.undoHistory = new UndoHistory(this.xmlState, this);
		this.undoHistory.setStateChangeEvent(function() {
			self.refreshDisplay();
		});
		this._documentAndSchemaReady();
	},
	
	// Schema object loaded event
	_schemaReady : function() {
		if (!this.options.targetNS) {
			this.targetNS = this.schema.namespace;
		}
		this.schemaTree = new SchemaTree(this.schema);
		this.schemaTree.build();
		this._documentAndSchemaReady();
	},
	
	// Performs initialization of editor after rejoining document and schema loading workflows
	// to support asychronous/multithreaded loading 
	_documentAndSchemaReady : function() {
		// Join back up asynchronous loading of document and schema
		if (!this.schemaTree || !this.xmlState)
			return;

		this.targetPrefix = this.xmlState.namespaces.getNamespacePrefix(this.options.targetNS);
		
		this.constructEditor();
		this.refreshDisplay();
		this.activeEditor.selectRoot();
		// Capture baseline undo state
		this.undoHistory.captureSnapshot();
	},
	
	// Construct user interface components of the editor
	constructEditor: function() {
		// Work Area
		this.xmlWorkAreaContainer = $("<div/>").attr('class', xmlWorkAreaContainerClass).appendTo(this.xmlEditorContainer);
		
		// Menu bar
		var editorHeaderBacking = $("<div/>").addClass(editorHeaderClass + "_backing").appendTo(this.xmlWorkAreaContainer);
		this.editorHeader = $("<div/>").attr('class', editorHeaderClass).appendTo(this.xmlWorkAreaContainer);
		if (this.options.documentTitle != null)
			$("<h2/>").html("Editing Description: " + this.options.documentTitle).appendTo(this.editorHeader);
		this.menuBar.render(this.editorHeader);
		editorHeaderBacking.height(this.editorHeader.outerHeight());
		// Create grouping of header elements that need to be positioned together
		this.editorHeaderGroup = this.editorHeader.add(editorHeaderBacking);
		
		this.xmlTabContainer = $("<div/>").attr("class", editorTabAreaClass).css("padding-top", this.editorHeader.height() + "px").appendTo(this.xmlWorkAreaContainer);
		this.problemsPanel = $("<pre/>").attr('class', problemsPanelClass).hide().appendTo(this.xmlTabContainer);
		
		this.guiEditor.initialize(this.xmlTabContainer);
		this.modeChange(0);
		
		var self = this;
		$(window).resize($.proxy(this.resize, this));
		
		this.modifyMenu.initialize(this.xmlEditorContainer);
		this.modifyMenu.addMenu(addElementMenuClass, this.options.addElementMenuHeaderText, 
				true, false, true);
		this.modifyMenu.addAttributeMenu(addAttrMenuClass, this.options.addAttrMenuHeaderText, 
				true, false, true);
		this.modifyMenu.addNodeMenu(addNodeMenuClass, "Add Nodes", true, false);
		this.addTopLevelMenu = this.modifyMenu.addMenu(addTopMenuClass, this.options.addTopMenuHeaderText, 
				true, true, false, function(target) {
			var selectedElement = self.guiEditor.selectedElement;
			if (!selectedElement || selectedElement.length == 0 || selectedElement.isRootElement) 
				return null;
			var currentElement = selectedElement;
			while (currentElement.parentElement != null) {
				if (currentElement.parentElement.isRootElement)
					break;
				currentElement = currentElement.parentElement;
			}
			if (currentElement != null)
				return currentElement;
			return null;
		}).populate(this.guiEditor.rootElement);
		
		this.setEnableKeybindings(this.options.enableGUIKeybindings);
		if (this.options.floatingMenu) {
			$(window).bind('scroll', $.proxy(this.modifyMenu.setMenuPosition, this.modifyMenu));
		}

		this.ready = true;
	},
	
	// Resize event for refreshing menu and editor sizes
	resize: function () {
		this.xmlTabContainer.width(this.xmlEditorContainer.outerWidth() - this.modifyMenu.menuColumn.outerWidth());
		if (this.activeEditor != null){
			this.activeEditor.resize();
		}
		this.editorHeader.width(this.xmlTabContainer.width());
		if (this.options.floatingMenu) {
			this.modifyMenu.setMenuPosition();
		}
	},
	
	// Event which triggers the creation of a new child element, as defined by an instigator such as a menu
	addChildElementCallback: function (instigator, relativeTo, prepend) {
		if ($(instigator).hasClass("disabled"))
			return;
		var xmlElement = $(instigator).data("xml").target;
		var objectType = $(instigator).data("xml").objectType;
		
		this.addChildElement(xmlElement, objectType, relativeTo, prepend);
	},

	addChildElement: function(parentElement, newElementDefinition, relativeTo, prepend) {
		if (!parentElement.allowChildren)
			return null;

		// If in the text editor view, synchronous the text to the xml model and ensure wellformedness
		if (this.textEditor.active) {
			if (this.xmlState.changesNotSynced()) {
				try {
					this.setXMLFromEditor();
				} catch (e) {
					this.addProblem("Unable to add element, please fix existing XML syntax first.", e);
					return;
				}
			}
		}

		var objectType;
		if (typeof newElementDefinition == 'string' || newElementDefinition instanceof String) {
			var defs = parentElement.objectType.elements;
			
			for (var index in defs)  {
				var definition = defs[index];
				var elementName = this.xmlState.getNamespacePrefix(definition.namespace) 
						+ definition.localName;
				if (elementName == newElementDefinition) {
					objectType = definition;
					break;
				}
			}

			// No matching child definition and parent doesn't allow "any", so can't add child
			if (!objectType && !parentElement.objectType.any) {
				return "Could not add child " + newElementDefinition + ", it is not a valid child of " + parentElement.objectType.localName;
			}
		} else {
			objectType = newElementDefinition;
		}

		// Create the new element as a child of its parent
		var newElement;
		if (objectType) {
			// Determine if it is valid to add this child element to the given parent element
			if (!parentElement.childCanBeAdded(objectType))
				return;
			
			// Add the namespace of the new element to the root if it is not already present
			this.xmlState.addNamespace(objectType);
			newElement = parentElement.addElement(objectType, relativeTo, prepend);
		} else {
			var nameParts = newElementDefinition.split(":");
			this.xmlState.addNamespace(nameParts.length > 1? nameParts[0] : "");
			newElement = parentElement.addNonschemaElement(newElementDefinition, relativeTo, prepend);
		}
		
		if (newElement == null) {
			return "Failed to add child of type " + newElementDefinition;
		}
		
		// Trigger post element creation event in the currently active editor to handle UI updates
		this.activeEditor.addElementEvent(parentElement, newElement);

		return newElement;
	},
	
	// Event which adds an attribute to an element, as defined by an instigator such as a menu
	addAttributeButtonCallback: function(instigator) {
		if ($(instigator).hasClass("disabled"))
			return;
		// Create attribute on the targeted parent, and add its namespace if missing
		var data = $(instigator).data('xml');

		return this.addAttribute(data.target, data.objectType, instigator);
	},

	addAttribute: function(xmlElement, attrDefinition, instigator) {

		// Synchronize xml document if there are unsynchronized changes in the text editor
		if (this.xmlState.changesNotSynced()) {
			try {
				this.setXMLFromEditor();
			} catch (e) {
				alert(e.message);
				return;
			}
		}

		var objectType;
		if ($.type(attrDefinition) === "object") {
			objectType = attrDefinition;
		} else {
			var defs = xmlElement.objectType.attributes;
			
			for (var index in defs)  {
				var definition = defs[index];
				var attrName = this.xmlState.getNamespacePrefix(definition.namespace) 
						+ definition.localName;
				if (attrName == attrDefinition) {
					objectType = definition;
					break;
				}
			}

			if (!objectType && !xmlElement.objectType.anyAttribute) {
				return "Could not add attribute " + attrDefinition + ", it is not a valid for element " + xmlElement.objectType.localName;
			}
		}

		var newAttr;
		if (objectType) {
			this.xmlState.addNamespace(objectType);
			newAttr = xmlElement.addAttribute(objectType);
		} else {
			var nameParts = attrDefinition.split(":");
			if (nameParts.length > 1)
				this.xmlState.addNamespace(nameParts[0]);
			newAttr = xmlElement.addAttribute({
				attribute : true,
				localName : attrDefinition
			});
			//newAttr = xmlElement.addNonschemaAttribute(newElementDefinition);
		}

		// Inform the active editor of the newly added attribute
		this.activeEditor.addAttributeEvent(xmlElement, newAttr, $(instigator));

		return newAttr;
	},

	addNodeCallback: function(instigator, nodeType, prepend) {
		if ($(instigator).hasClass("disabled"))
			return;

		var data = $(instigator).data('xml');

		this.addNode(data.target, nodeType, prepend);
	},

	addNode: function(parentElement, nodeType, prepend, relativeTo) {

		// Synchronize xml document if there are unsynchronized changes in the text editor
		if (this.xmlState.changesNotSynced()) {
			try {
				this.setXMLFromEditor();
			} catch (e) {
				alert(e.message);
				return;
			}
		}

		if (!(parentElement instanceof XMLElement)) {
			return;
		}

		// Create node on the targeted parent
		var nodeObject = parentElement.addNode(nodeType, prepend, relativeTo);
		// Inform the active editor of the newly added attribute
		if (nodeObject) {
			this.guiEditor.selectNode(nodeObject);
			this.activeEditor.addNodeEvent(parentElement, nodeObject);
			nodeObject.focus();
		}
	},

	// Adds an element stub either as a child of an element which allows children, or 
	// as a sibling
	addNextElement : function(xmlElement, prepend) {
		if (xmlElement.allowChildren) {
			this.addNode(xmlElement, "element", prepend);
		} else {
			this.addNode(xmlElement.parentElement, "element", prepend, xmlElement);
		}
	},

	// Triggered when a document has been loaded or reloaded
	documentLoadedEvent : function(newDocument) {
		if (this.guiEditor != null && this.guiEditor.rootElement != null)
			this.guiEditor.rootElement.xmlNode = newDocument.children().first();
		if (this.problemsPanel != null)
			this.clearProblemPanel();
	},
	
	// Switch the currently active editor to the editor identified
	modeChange: function(mode) {
		// Can't change mode to current mode
		if ((mode == 0 && this.guiEditor.active) || (mode == 1 && this.textEditor.active))
			return this;
			
		if (mode == 0) {
			$("*:focus").blur();
			$(".xml_editor_container *:focus").blur();

			if (this.textEditor.isInitialized() && this.xmlState.isChanged()) {
				// Try to reconstruct the xml object before changing tabs.
				this.setXMLFromEditor();
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
			$("#" + xmlMenuHeaderPrefix + this.options.xmlEditorLabel.replace(/ /g, "_")).addClass("active_mode_tab");
		} else {
			this.activeEditor = this.textEditor;
			$("#" + xmlMenuHeaderPrefix + this.options.textEditorLabel.replace(/ /g, "_")).addClass("active_mode_tab");
		}
		this.activeEditor.activate();
		if (this.ready)
			this.resize();
		return this;
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
	
	setTextArea : function(xmlString) {
		if (this.isTextAreaEditor)
			this.element.val(xmlString);
	},
	
	// Refresh the state of the XML document from the contents of text editor 
	setXMLFromEditor: function() {
		var xmlString = this.textEditor.aceEditor.getValue();
		this.xmlState.setXMLFromString(xmlString);
		if (this.guiEditor.isActive) {
			this.guiEditor.setRootElement(this.xmlState.xml.children()[0]);
			this.addTopLevelMenu.populate(this.guiEditor.rootElement)
		}
	},
	
	// Callback for submit button pressing.  Performs a submit function and then uploads the 
	// document to the provided URL, if configured to do either
	submitXML: function(config) {
		if (config.onSubmit) {
			config.onSubmit.call(this, config);
		}

		if (config.url) {
			this.uploadXML(config);
		}
	},
	
	// Export the contents of the editor as text to a file, as supported by browsers
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

	// Upload the contents of the editor to a path
	uploadXML: function(config) {
		if (!config || !config.url) {
			if (this.submitButtonConfigs.length > 0 && this.submitButtonConfigs[0].url) {
				config = this.submitButtonConfigs[0];
			} else {
				this.addProblem("Cannot submit because no post Options");
				return;
			}
		}

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
			url : config.url,
			contentType : "application/xml",
			type : "POST",
			data : xmlString,
			success : function(response) {
				// Process the response from the server using the provided response handler
				// If the result of the handler evaluates true, then it is assumed to be an error
				var outcome = config.responseHandler(response);

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
				if (config.errorHandler) {
					config.errorHandler(jqXHR, exception);
					return;
				}

				self.options.submitErrorHandler(jqXHR, exception);
			}
		});
	},
	
	// Default server submission response parser, mostly for reference.  
	swordSubmitResponseHandler: function(response) {
		var responseObject = $(response);
		if (responseObject.length > 0 && localName(responseObject[responseObject.length - 1]) == "sword:error") {
			return responseObject.find("atom\\:summary").html();
		}
		return false;
	},

	// Serializes the provided xml node into a string
	xml2Str: function(xmlNodeObject) {
		if (xmlNodeObject == null)
			xmlNodeObject = this.xmlState.xml;
		var xmlNode = (xmlNodeObject instanceof jQuery? xmlNodeObject[0]: xmlNodeObject);
		var xmlStr = "";
		if (this.options.prettyXML) {
			return formatXML(xmlNode);
		} else {
			try {
				// Gecko-based browsers, Safari, Opera.
				return (new XMLSerializer()).serializeToString(xmlNode);
			} catch (e) {
				try {
					// Internet Explorer.
					return xmlNode.xml;
				} catch (e) {
					this.addProblem('Xmlserializer not supported', e);
					return false;
				}
			}
		}
	},
	
	// Add a error/problem message to the error display
	addProblem: function(message, problem) {
		this.problemsPanel.html(message + "<br/>");
		if (problem !== undefined) {
			if (problem.substring) {
				this.problemsPanel.append(problem.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
			} else {
				this.problemsPanel.append(problem.message.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
			}
		}
		console.error(problem);
		this.refreshProblemPanel();
	},
	
	// Clear the listing of errors
	clearProblemPanel: function() {
		this.problemsPanel.hide();
	},
	
	// Update whether or not the error panel is displayed
	refreshProblemPanel: function() {
		if (this.problemsPanel.html() == "") {
			this.problemsPanel.hide("fast");
		} else {
			this.problemsPanel.show("fast");
		}
	},

	// Performs an equality comparison between two nodes, returning true if they match namespace uri and element name
	nsEquals: function(node, element, elementNS) {
		if (element.substring)
			return element == localName(node) && elementNS == node.namespaceURI;
		return localName(element) == localName(node) && node.namespaceURI == element.namespace;
	},
	
	// Strips the namespace prefix off an element name
	stripPrefix: function(name) {
		var index = name.indexOf(":");
		return index == -1? name: name.substring(index + 1);
	},
	
	setEnableKeybindings : function(enable) {
		if (enable) {
			this.options.enableGUIKeybindings = true;
			this.menuBar.menuBarContainer.removeClass("xml_bindings_disabled");
			$(window).on("keydown.xml_keybindings", $.proxy(this.keydownCallback, this));
		} else {
			this.options.enableGUIKeybindings = false;
			this.menuBar.menuBarContainer.addClass("xml_bindings_disabled");
			$(window).off("keydown.xml_keybindings");
		}
	},

	getFocusedInput: function() {
		return $("input:focus, textarea:focus, select:focus");
	},
	
	// Initialize key bindings
	keydownCallback: function(e) {
		var prepend = this.options.prependNewElements ^ e.shiftKey;

		if (this.guiEditor.active) {
			var focused = this.getFocusedInput();
			
			// Escape key, blur the currently selected input or deselect selected element
			if (e.which == 27) {
				if (focused.length > 0) {
					focused.blur();
				} else this.guiEditor.selectNode(null);
				return false;
			}
			
			// Tab, select the next input
			if (e.which == 9) {
				e.preventDefault();
				this.guiEditor.focusInput(e.shiftKey);
				return false;
			}
			
			// Delete key press while item selected but nothing is focused.
			if (e.which == 46 && focused.length == 0) {
				this.guiEditor.deleteSelected();
				return false;
			}
			
			if (e.which > 36 && e.which < 41){
				if (e.altKey && (focused.length == 0 || focused.is("textarea"))) {
					e.preventDefault();
					// Alt + up or down move the element up and down in the document
					this.guiEditor.moveSelected(e.which == 38);
					if (focused.is("textarea"))
						focused.focus();
					return false;
				}
				if (focused.length == 0) {
					e.preventDefault();
					if (e.shiftKey) {
						// If holding shift while pressing up or down, then jump to the next/prev sibling
						if (e.which == 40 || e.which == 38) {
							this.guiEditor.selectSibling(e.which == 38);
						} else if (e.which == 37 || e.which == 39) {
							this.guiEditor.selectParent(e.which == 39);
						}
					} else {
						// If not holding shift while hitting up or down, go to the next/prev element
						if (e.which == 40 || e.which == 38){
							this.guiEditor.selectNext(e.which == 38);
						} else if (e.which == 37 || e.which == 39) {
							this.guiEditor.selectAttribute(e.which == 37);
						}
					}
				}
				return true;
			}
			
			if ((e.metaKey || e.ctrlKey) && focused.length == 0 && e.which == 'Z'.charCodeAt(0)) {
				// Undo
				this.undoHistory.changeHead(e.shiftKey? 1: -1);
				return false;
			} else if ((e.metaKey || e.ctrlKey) && focused.length == 0 && e.which == 'Y'.charCodeAt(0)){
				// Redo
				this.undoHistory.changeHead(1);
				return false;
			}
		}
		
		if (e.altKey && e.ctrlKey) {
			// Save, on either tab.
			if (e.which == 'S'.charCodeAt(0)) {
				$("." + submitButtonClass).click();
				return false;
			}
			
			if (e.which == 'E'.charCodeAt(0)) {
				this.exportXML();
				return false;
			}
			
			// Switch to the GUI editor
			if (e.which == '1'.charCodeAt(0)) {
				this.modeChange(0);
				return false;
			}
			
			// Switch to the text editor
			if (e.which == '2'.charCodeAt(0)) {
				this.modeChange(1);
				return false;
			}
		}

		if (this.guiEditor.active) {
			var selected = this.guiEditor.selectedElement;

			// Enter, contextual adding
			if (e.which == 13) {
				var focused = this.getFocusedInput();
				if (focused.length == 0 || e.altKey) {
					if (selected instanceof XMLElement) {
						this.addNextElement(selected, e.shiftKey);
					} else if (selected instanceof XMLElementStub 
							|| selected instanceof XMLAttributeStub) {
						selected.create();
					}
					e.preventDefault();
					return false;
				}
				return true;
			}

			if (e.altKey) {
				if (e.which == 'E'.charCodeAt(0)) {
					if (selected instanceof XMLElement && selected.allowChildren)
						this.addNode(selected, "element", prepend);
					return false;
				}

				if (e.which == 'S'.charCodeAt(0)) {
					if (selected)
						this.addNode(selected.parentElement, "element", prepend, selected);
					return false;
				}

				if (e.which == 'P'.charCodeAt(0)) {
					if (selected && selected.parentElement.objectType)
						this.addNode(selected.parentElement, "element", prepend);
					return false;
				}

				if (e.which == 'R'.charCodeAt(0)) {
					this.addNode(this.guiEditor.rootElement, "element", prepend);
					return false;
				}

				if (e.which == 'A'.charCodeAt(0)) {
					if (selected)
						this.addNode(selected, "attribute", prepend);
					return false;
				}

				if (e.which == 'T'.charCodeAt(0)) {
					if (selected)
						this.addNode(selected, "text", prepend);
					return false;
				}

				if (e.which == 191) {
					if (selected)
						this.addNode(selected, "comment", prepend);
					return false;
				}

				if (e.which == 188) {
					if (selected)
						this.addNode(selected, "cdata", prepend);
					return false;
				}
			}
		}
		
		return true;
	},
	
	// Menu Update functions
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
	
	// Performs updates to the menu for changing element/attribute selection
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
	}
});
function AbstractXMLObject(objectType, editor) {
	this.editor = editor;
	this.guiEditor = this.editor.guiEditor;
	this.objectType = objectType;

	// ID of the dom node for this element
	this.domNodeID = null;
	// dom node for this element
	this.domNode = null;
	// XMLElement which is the parent of this element
	this.parentElement = null;
	// Main input for text node of this element
	this.textInput = null;
}

// Generates input fields for elements and attributes, depending on the type of value in the definition
// inputID - id attribute for the new input field
// startingValue - initial value for the new input
// appendTarget - DOM element which the new input will be append to
AbstractXMLObject.prototype.createElementInput = function (inputID, startingValue, appendTarget){
	if (startingValue === undefined)
		startingValue = "";
	var input = null;
	var $input = null;
	// Select input for fields with a predefined set of values
	if (this.objectType.values && this.objectType.values.length > 0){
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
		if ((startingValue == " ") || (startingValue == ""))
			input.selectedIndex = -1;
		$input = $(input);
	} // Text area for normal elements and string attributes
	else if ((this.objectType.text && (this.objectType.type == 'string' || this.objectType.type == 'mixed')) 
			|| this.objectType.attribute || this.objectType.cdata || this.objectType.comment){
		input = document.createElement('textarea');
		input.id = inputID;
		input.className = 'xml_textarea';
		// Text areas start out with a space so that the pretty formating won't collapse the field
		input.value = startingValue? startingValue : " ";
		appendTarget.appendChild(input);
		
		$input = $(input);
		var self = this;
		// Clear out the starting space on first focus.  This space is there to prevent field collapsing
		// on new elements in the text editor view
		$input.one('focus', function() {
			if (self.editor.options.expandingTextAreas)
				$input.autosize();
			if (this.value == " ")
				this.value = "";
		});
	} else if (this.objectType.type == 'date'){
		// Some browsers support the date input type at this point.  If not, it just behaves as text
		input = document.createElement('input');
		input.type = 'date';
		input.id = inputID;
		input.className = 'xml_date';
		input.value = startingValue? startingValue : "";
		appendTarget.appendChild(input);
		
		$input = $(input);
	} else if (this.objectType.type){
		input = document.createElement('input');
		if (this.objectType.type == 'date') {
			// Some browsers support the date input type.  If not, it should behaves as text
			input.type = 'date';
			input.className = 'xml_date';
		} else if (this.objectType.type == 'dateTime') {
			// May not be supported by browsers yet
			input.type = 'datetime';
			input.className = 'xml_datetime';
		} else {
			// All other types as text for now
			input.type = 'text';
			input.className = 'xml_input';
		}
		input.id = inputID;
		input.value = startingValue? startingValue : "";
		appendTarget.appendChild(input);
		
		$input = $(input);
	}
	return $input;
};

// Change the editors focus to this xml object
AbstractXMLObject.prototype.focus = function() {
	if (this.domNode != null)
		this.guiEditor.focusObject(this.domNode);
	if (this.textInput)
		this.textInput.focus();
};

AbstractXMLObject.prototype.getDomNode = function () {
	return this.domNode;
};

// Remove this element from the xml document and editor
AbstractXMLObject.prototype.remove = function() {
	// Remove the element from the xml doc
	this.xmlNode.remove();
	
	if (this.domNode != null) {
		this.domNode.remove();
	}
};

// Swap the gui representation of this element to the location of swapTarget
AbstractXMLObject.prototype.swap = function (swapTarget) {
	if (swapTarget == null) {
		return;
	}
	
	// Swap the xml nodes
	swapTarget.xmlNode.detach().insertAfter(this.xmlNode);
	if (swapTarget.domNode != null && this.domNode != null) {
		// Swap the gui nodes
		swapTarget.domNode.detach().insertAfter(this.domNode);
	}
};

// Move this element up one location in the gui.  Returns true if the swap was able to happen
AbstractXMLObject.prototype.moveUp = function() {
	var previousSibling = this.domNode.prev("." + xmlNodeClass);
	if (previousSibling.length > 0) {
		this.swap(previousSibling.data("xmlObject"));
		return true;
	} else {
		return false;
	}
};

// Move this element down one location in the gui.  Returns true if the swap was able to happen
AbstractXMLObject.prototype.moveDown = function() {
	var nextSibling = this.domNode.next("." + xmlNodeClass);
	if (nextSibling.length > 0) {
		nextSibling.data("xmlObject").swap(this);
		return true;
	} else {
		return false;
	}
};

AbstractXMLObject.prototype.select = function() {
	this.domNode.addClass("selected");
};

AbstractXMLObject.prototype.isSelected = function() {
	return this.domNode.hasClass("selected");
};
function AddNodeMenu(menuID, label, expanded, enabled, owner, editor) {
	this.menuID = menuID;
	// Refence to jquery object which contains the menu options
	this.menuContent = null;
	// Indicates if the menu can be interacted with
	this.enabled = enabled;
	this.owner = owner;
	this.editor = editor;
	this.label = label;
	this.expanded = expanded;
}

AddNodeMenu.prototype.constructor = AddNodeMenu;
AddNodeMenu.prototype = Object.create( ModifyElementMenu.prototype );

AddNodeMenu.prototype.destroy = function() {
	if (this.menuContent != null)
		this.menuContent.remove();
};

AddNodeMenu.prototype.initEventHandlers = function() {
	var self = this;
	// Add new child element click event
	this.menuContent.on('click', 'li', function(event){
		var prepend = self.editor.options.prependNewElements;
		if (event.shiftKey) prepend = !prepend;
		self.owner.editor.addNodeCallback(this, $(this).data("xml").nodeType, prepend);
	});
};

AddNodeMenu.prototype.populate = function(xmlElement) {

	if (this.expanded)
		this.menuContent.css("height", "auto");
	var startingHeight = this.menuContent.outerHeight();
	this.menuContent.empty();

	if (!this.editor.guiEditor.active || !(xmlElement instanceof XMLElement)){
		this.menuHeader.addClass("disabled");
		this.enabled = false;
		return;
	}

	if (xmlElement.allowChildren) {
		$("<li>Add Element</li>").data('xml', {
			target : xmlElement,
			nodeType : "element"
		}).appendTo(this.menuContent);
	}

	if (xmlElement.allowAttributes) {
		$("<li>Add Attribute</li>").data('xml', {
			target : xmlElement,
			nodeType : "attribute"
		}).appendTo(this.menuContent);
	}

	$("<li>Add CDATA</li>").data('xml', {
		target : xmlElement,
		nodeType : "cdata"
	}).appendTo(this.menuContent);

	$("<li>Add comment</li>").data('xml', {
		target : xmlElement,
		nodeType : "comment"
	}).appendTo(this.menuContent);

	if (xmlElement.objectType.type != null && xmlElement.allowText) {
		this.addButton = $("<li>Add text</li>").attr({
			title : 'Add text'
		}).data('xml', {
			target : xmlElement,
			nodeType : "text"
		}).appendTo(this.menuContent);
	}

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

AddNodeMenu.prototype.clear = function() {
	this.menuContent.hide();
};
function AttributeMenu(menuID, label, expanded, enabled, owner, editor) {
	ModifyElementMenu.call(this, menuID, label, expanded, enabled, owner, editor);
}

AttributeMenu.prototype.constructor = AttributeMenu;
AttributeMenu.prototype = Object.create( ModifyElementMenu.prototype );

AttributeMenu.prototype.initEventHandlers = function() {
	var self = this;
	this.menuContent.on('click', 'li', function(event){
		self.owner.editor.addAttributeButtonCallback(this);
	});
};

AttributeMenu.prototype.populate = function (xmlElement) {
	if (xmlElement == null || (this.target != null && xmlElement.domNode != null 
			&& this.target[0] === xmlElement.domNode[0]))
		return;
	
	if (this.expanded)
		this.menuContent.css("height", "auto");
	var startingHeight = this.menuContent.outerHeight();
	this.menuContent.empty();
	
	this.target = xmlElement;
	
	var attributesArray = this.target.objectType.attributes;
	if (attributesArray) {
		var attributesPresent = {};
		$(this.target.xmlNode[0].attributes).each(function() {
			var targetAttribute = this;
			$.each(attributesArray, function(){
				if (this.name == targetAttribute.nodeName) {
					attributesPresent[this.name] = $("#" + xmlElement.domNodeID + "_" + targetAttribute.nodeName.replace(':', '-'));
				}
			});
		});
		
		var self = this;
		$.each(this.target.objectType.attributes, function(){
			var attribute = this;
			// Using prefix according to the xml document namespace prefixes
			var nsPrefix = self.editor.xmlState.getNamespacePrefix(attribute.namespace);
				
			var attrName = nsPrefix + attribute.localName;
			var addButton = $("<li/>").attr({
					title : 'Add ' + attrName,
					'id' : xmlElement.domNodeID + "_" + attrName.replace(":", "_") + "_add"
				}).html(attrName)
				.data('xml', {
					"objectType": attribute,
					"target": xmlElement
				}).appendTo(self.menuContent);
			
			if (attribute.name in attributesPresent) {
				addButton.addClass("disabled");
				if (attributesPresent[attribute.name].length > 0)
					attributesPresent[attribute.name].data('xmlAttribute').addButton = addButton;
			}
		});
	}
		
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
 * Manages and tracks the state of the underlying XML document being edited.
 */

function DocumentState(baseXML, editor) {
	this.baseXML = baseXML;
	this.xml = null;
	this.changeState = 0;
	this.editor = editor;
	this.schemaTree = this.editor.schemaTree;
	this.domParser = null;
	if (window.DOMParser)
		this.domParser = new DOMParser();
	this.setXMLFromString(this.baseXML);
	this.namespaces = new NamespaceList();
}

// Indicates if the document has been modified from its original state
DocumentState.prototype.isChanged = function() {
	return this.changeState > 1;
};
// Indicates the document has not been modified since it was originally loaded.
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

// Notify the document state that the document was modified
DocumentState.prototype.documentChangedEvent = function() {
	this.changeState = 2;
	this.editor.undoHistory.captureSnapshot();
	this.updateStateMessage();
	// Update the backing textarea if the editor was initialized on one
	if (this.editor.isTextAreaEditor) {
		var xmlString = this.editor.xml2Str(this.xml);
		this.editor.setTextArea(xmlString);
	}
};
// Notify the document that changes have been saved
DocumentState.prototype.changesCommittedEvent = function() {
	this.changeState = 1;
	this.updateStateMessage();
};
//
DocumentState.prototype.changeEvent = function() {
	if (this.changeState < 2)
		this.changeState = 2;
	this.updateStateMessage();
};
// Document has been changed in a manner which does not require synching
DocumentState.prototype.syncedChangeEvent = function() {
	this.changeState = 2;
	this.updateStateMessage();
};
// Document changed in a manner which requires synching
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

// Register a namespace and prefix to the document if it is not already present
// The namespace will be recorded on the root element if possible
DocumentState.prototype.addNamespace = function(prefixOrType, namespace) {
	if (prefixOrType == null && !namespace)
		return;

	var prefix;
	if (typeof prefixOrType === "object"){
		// When adding a ns from a schema definition, use schema prefix
		namespace = prefixOrType.namespace;
		prefix = this.editor.schemaTree.namespaces.namespaceToPrefix[namespace];
	} else {
		prefix = prefixOrType;
	}

	// If prefix or namespace already exist, don't add anything
	if (this.namespaces.containsURI(namespace))
		return;

	var prefixExists = this.namespaces.containsPrefix(prefix);

	var nsPrefix = prefix;
	// have a prefix but no namespace, then generate one
	if (prefix != null && !namespace) {
		namespace = ("urn:ns:local:xxxxxx-" + (new Date().getTime() % 0x1000000).toString(16)).replace(/x/g, function(c) {
			return (Math.random()*16|0).toString(16);
		});
	} else if (namespace && (prefix == null || prefixExists)) {
		// No prefix or duplicate, so generate an incremented prefix
		if (!prefix)
			nsPrefix = "ns";
		var i = 0;
		while (nsPrefix in this.namespaces.namespaceURIs)
			nsPrefix = prefix + (++i);
	}

	var documentElement = this.xml[0].documentElement;
	if (documentElement.setAttributeNS) {
		documentElement.setAttributeNS('http://www.w3.org/2000/xmlns/', 
			"xmlns" + (nsPrefix? ':' : '') + nsPrefix, namespace);
	}
	else documentElement.setAttribute('xmlns:' + nsPrefix, namespace);
	this.namespaces.addNamespace(namespace, nsPrefix);
}

// Extract all namespace uri/prefixes present in the document and store them
DocumentState.prototype.extractNamespacePrefixes = function() {
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

DocumentState.prototype.getNamespacePrefix = function(nsURI) {
	var prefix = this.namespaces.getNamespacePrefix(nsURI);
	if (prefix === undefined)
		prefix = this.editor.schemaTree.namespaces.getNamespacePrefix(nsURI);

	return prefix;
};

// Since there are many versions of DOM parsers in IE, try them until one works.
DocumentState.prototype.getIEXMLParser = function() {
	var progIDs = [ 'Msxml2.DOMDocument.6.0', 'Msxml2.DOMDocument.3.0', 'Microsoft.XMLDOM' ];
	for (var i = 0; i < progIDs.length; i++) {
		try {
			var xmlDOM = new ActiveXObject(progIDs[i]);
			return xmlDOM;
		} catch (e) { }
	}
	return null;
};

// Deserialize a string representation of XML into an XML document
DocumentState.prototype.setXMLFromString = function(xmlString) {
	// Strip out weird namespace header that IE adds to the document
	var xmlDoc,
		nsHeaderIndex = xmlString.indexOf('<?XML:NAMESPACE');
	if (nsHeaderIndex != -1) {
		nsHeaderIndex = xmlString.indexOf('/>', nsHeaderIndex);
		xmlString = xmlString.substring(nsHeaderIndex + 2);
	}
	// parseXML doesn't return any info on why a document is invalid, so do it the old fashion way.
	if (this.domParser) {
		xmlDoc = this.domParser.parseFromString(xmlString, "application/xml");
		var parseError = xmlDoc.getElementsByTagName("parsererror");
		if (parseError.length > 0){
			throw new Error($(parseError).text());
		}
	} else {
		xmlDoc = this.getIEXMLParser();
		xmlDoc.async = false;
		xmlDoc.loadXML(xmlString);
		if (xmlDoc.parseError.errorCode != 0) {
			throw new Error("Error in line " + xmlDoc.parseError.line + " position " + xmlDoc.parseError.linePos
					+ "\nError Code: " + xmlDoc.parseError.errorCode + "\nError Reason: "
					+ xmlDoc.parseError.reason + "Error Line: " + xmlDoc.parseError.srcText);
		}
	}
	
	// Store the new document and inform editor it is dealing with a new document
	this.xml = $(xmlDoc);
	this.editor.documentLoadedEvent(this.xml);
};
var XML_CHAR_MAP = {
	'<': '&lt;',
	'>': '&gt;',
	'&': '&amp;',
	'"': '&quot;',
	"'": '&apos;'
};

function escapeXml (s) {
	return s.replace(/[<>&"']/g, function (ch) {
		return XML_CHAR_MAP[ch];
	});
}

function formatXML(element, indent, options) {

	var children = element.childNodes;
	var prevNode = null;
	var whitespace = "";
	var containsText = false;

	var contents = "";
	var attrContents = "";

	for (var index in children) {
		var childNode = children[index]
		switch (childNode.nodeType) {
			case 1 : // element
				var tagIndent = "";
				var nextIndent = "";
				if (!containsText) {
					if (element.nodeType != 9) {
						nextIndent =  indent + "  ";
						tagIndent = "\n";
					}
				}

				contents += tagIndent + formatXML(childNode, nextIndent, options);
				containsText = false;
				break;
			case 3 : // text
				var value = childNode.nodeValue;
				if ($.trim(value)) {
					contents += whitespace + escapeXml(value);
					whitespace = "";
					containsText = true;
				} else {
					whitespace = value;
				}
				break;
			case 4 : // cdata
				if (!containsText) {
					if (element.nodeType != 9) {
						contents += "\n" + indent + "  ";
					}
				}
				contents += "<![CDATA[" + childNode.nodeValue + "]]>";
				break;
			case 8 : // comment
				if (!containsText) {
					if (element.nodeType != 9) {
						contents += "\n" + indent + "  ";
					}
				}
				contents += "<!--" + escapeXml(childNode.nodeValue) + "-->";
				break;
		}

		prevNode = childNode;
	}

	var attributes = element.attributes;
	if (attributes) {
		var xmlnsPattern = /^xmlns:?(.*)$/;
		var previousWasNS = false;
		for (var index = 0; index < attributes.length; index++) {
			if (previousWasNS) {
				attrContents += "\n" + indent + "   ";
				previousWasNS = false;
			}
			attrContents += " " + attributes[index].nodeName + '="' + escapeXml(attributes[index].nodeValue) +'"';
			if (xmlnsPattern.test(attributes[index].nodeName))
				previousWasNS = true;
		}
	}
	
	if (element.nodeType == 1) {
		if (contents) {
			var closingIndent = (!containsText)? "\n" + indent : "";
			return indent + "<" + element.nodeName + attrContents + ">" + contents + closingIndent + "</" + element.nodeName + ">";
		} else {
			return indent + "<" + element.nodeName + attrContents + " />";
		}
	} else {
		return contents;
	}
	
}
;
/**
 * Graphical editor
 */

function GUIEditor(editor) {
	this.editor = editor;
	this.guiContent = null;
	this.xmlContent = null;
	this.elementIndex = 0;
	this.rootElement = null;
	this.active = false;
}

GUIEditor.prototype.initialize = function(parentContainer) {
	this.xmlContent = $("<div class='" + xmlContentClass + "'/>");
	this.xmlContent.data("xml", {});
	this.placeholder = $("<div/>").attr("class", "placeholder").html("There are no elements in this document.  Use the menu on the right to add new top level elements.")
			.appendTo(this.xmlContent);
	
	this.guiContent = $("<div/>").attr({'id' : guiContentClass + this.editor.instanceNumber, 'class' : guiContentClass}).appendTo(parentContainer);
	
	this.guiContent.append(this.xmlContent);
	
	this.documentElement = new AbstractXMLObject(null, this.editor);
	this.documentElement.domNode = this.xmlContent;
	this.documentElement.nodeContainer = this.xmlContent;
	this.documentElement.placeholder = this.placeholder;
	
	this.setRootElement(this.editor.xmlState.xml.children()[0], false);
	
	this._initEventBindings();
	return this;
};

// Set the root element for this editor 
// node - xml node from an xml document to be used as the root node for this editor
GUIEditor.prototype.setRootElement = function(node, render) {
	var objectType = this.editor.schemaTree.getElementDefinition(node);
	if (objectType == null)
		objectType = this.editor.schemaTree.rootElement;
	this.rootElement = new XMLElement(node, objectType, this.editor);
	if (render || arguments.length == 1)
		this.rootElement.render(this.documentElement, true);
};

// Initialize editor wide event bindings
GUIEditor.prototype._initEventBindings = function() {
	var self = this;
	// Attributes
	this.xmlContent.on('click', '.' + attributeContainerClass, function(event){
		$(this).data('xmlAttribute').select();
		event.stopPropagation();
	}).on('click', '.' + attributeContainerClass + " > a:not(.create_attr)", function(event){
		var attribute = $(this).parents('.' + attributeContainerClass).eq(0).data('xmlAttribute');
		attribute.remove();
		attribute.xmlElement.updated({action : 'attributeRemoved', target : attribute});
		self.editor.xmlState.documentChangedEvent();
		event.stopPropagation();
	}).on('change', '.' + attributeContainerClass + ' > input,.' + attributeContainerClass + ' > textarea,'
			+ '.' + attributeContainerClass + ' > select', function(event){
		var attribute = $(this).parents('.' + attributeContainerClass).eq(0).data('xmlAttribute');
		attribute.syncValue();
		attribute.xmlElement.updated({action : 'attributeSynced', target : attribute});
		self.editor.xmlState.documentChangedEvent();
	});
	// Element
	this.xmlContent.on('click', '.' + xmlNodeClass, function(event){
		self.selectNode(this);
		event.stopPropagation();
	}).on('click', '.move_up', function(event){
		self.moveNode($(this).parents('.' + xmlElementClass).eq(0).data('xmlObject'), true);
		event.stopPropagation();
	}).on('click', '.move_down', function(event){
		self.moveNode($(this).parents('.' + xmlElementClass).eq(0).data('xmlObject'));
		event.stopPropagation();
	}).on('click', '.' + xmlTextClass + ' .xml_delete', function(event){
		self.deleteText($(this).parents('.' + xmlTextClass).eq(0).data('xmlObject'));
		event.stopPropagation();
	}).on('click', '.top_actions .xml_delete', function(event){
		self.deleteElement($(this).parents('.' + xmlElementClass).eq(0).data('xmlObject'));
		event.stopPropagation();
	}).on('click', '.toggle_collapse', function(event){
		$(this).parents('.' + xmlElementClass).first().data('xmlObject').toggleCollapsed();
		event.stopPropagation();
		return;
		var $this = $(this);
		var contentBlock = $this.closest('.' + xmlElementClass).find('.content_block');
		if ($this.html() == "+") {
			$this.html("_");
			contentBlock.slideDown(200);
		} else {
			$this.html("+");
			contentBlock.slideUp(200);
		}
		event.stopPropagation();
	}).on('change', '.element_text', function(event){
		var $this = $(this);
		var xmlElement = $this.parents('.' + xmlElementClass).eq(0).data('xmlObject');
		var textObject = $this.parents(".xml_node").first().data('xmlObject');
		if (!textObject) return;
		textObject.syncText();
		xmlElement.updated({action : 'valueSynced'});
		self.editor.xmlState.documentChangedEvent();
	}).on('focus', '.xml_text_node .xml_textarea', function(event) {
		var textObject = $(this).parents(".xml_node").first().data('xmlObject');
		textObject.select();
		event.stopPropagation();
	}).on('click', '.xml_text_node', function(event) {
		var textObject = $(this).data('xmlObject');
		textObject.select();
		event.stopPropagation();
	});
};

GUIEditor.prototype.selectRoot = function() {
	this.selectNode($("." + xmlElementClass).first());
};

// Make this editor the active editor and show it
GUIEditor.prototype.activate = function() {
	this.active = true;
	this.deselect();
	
	
	this.editor.textEditor.resetSelectedTagRange();
	if (this.editor.textEditor.isModified() || (this.editor.textEditor.isInitialized() && this.editor.xmlState.isChanged())) {
		this.editor.refreshDisplay();
		this.editor.textEditor.setInitialized();
	}
	this.guiContent.show();
	
	this.selectRoot();
	return this;
};

// Deactivate and hide this editor
GUIEditor.prototype.deactivate = function() {
	this.active = false;
	this.guiContent.hide();
	return this;
};

// Get the next index in the sequence to be used for uniquely addressable ids
GUIEditor.prototype.nextIndex = function() {
	return xmlElementClass + (++this.elementIndex);
};

// Clear all elements
GUIEditor.prototype.clearElements = function() {
	$("." + topLevelContainerClass).remove();
	return this;
};

GUIEditor.prototype.resize = function() {
	//xmlContent.width(guiContent.width() - menuContainer.width() - 30);
	return this;
};

// Refresh the contents of this editor
GUIEditor.prototype.refreshDisplay = function() {
	this.deselect();
	this.elementIndex = 0;
	this.rootElement.xmlNode = this.editor.xmlState.xml.children().first();
	this.refreshElements();
	return this;
};

// Refresh the display of all elements
GUIEditor.prototype.refreshElements = function() {
	var node = this.documentElement.getDomNode();
	node.empty();
	node = node[0];
	var originalParent = node.parentNode;
	var fragment = document.createDocumentFragment();
	fragment.appendChild(node);
	
	// Clear out the previous contents and then rebuild it
	this.rootElement.render(this.documentElement, true);
	this.editor.addTopLevelMenu.populate(this.rootElement);
	
	originalParent.appendChild(fragment);
	return this;
};

// Inform the editor that a new element has been added, and update the editor state accordingly
GUIEditor.prototype.addElementEvent = function(parentElement, newElement) {
	if (parentElement.domNodeID != this.xmlContent.attr("id")) {
		parentElement.updated({action : 'childAdded', target : newElement});
	}
	
	var state = this.editor;

	this.focusObject(newElement.domNode);
	this.selectNode(newElement);
	this.focusSelectedText(newElement);
	if (parentElement == this.rootElement)
		this.editor.addTopLevelMenu.populate(this.rootElement);
	this.editor.xmlState.documentChangedEvent();
	this.editor.resize();
};

// Inform the editor that a new attribute has been added
GUIEditor.prototype.addAttributeEvent = function(parentElement, attribute, addButton) {

	parentElement.updated({action : 'attributeAdded', target : attribute.objectType.name});
	this.focusObject(attribute.domNode);
	attribute.select();
	addButton.addClass("disabled");
	attribute.addButton = addButton;
	this.editor.xmlState.documentChangedEvent();
	this.editor.resize();
};

GUIEditor.prototype.addNodeEvent = function(parentElement, xmlObject) {
	parentElement.updated({action : xmlObject.objectType.type + 'Added', target : parentElement});
	this.focusObject(xmlObject.domNode);
	this.editor.xmlState.documentChangedEvent();
	this.editor.resize();
}

GUIEditor.prototype.select = function(selected) {
	var container = selected.closest("." + attributeContainerClass + ",." + xmlNodeClass);
	if (container.is("." + attributeContainerClass)) {
		container.data("xmlAttribute").select();
	} else {
		this.selectNode(selected);
	}
}

// Select element selected and inform the editor state of this change
GUIEditor.prototype.selectNode = function(selected) {
	if (!selected || selected.length == 0) {
		this.deselect();
	} else {
		$(".selected").removeClass("selected");

		var selectedObject;
		if (selected instanceof Element || selected instanceof jQuery) {
			var $selected = $(selected);
			if ($selected.is("." + xmlNodeClass)) {
				selectedObject = $selected.data("xmlObject");
			} else {
				selectedObject = $selected.closest("." + xmlNodeClass).data("xmlObject");
			}
		} else {
			selectedObject = selected;
		}

		this.selectedNode = selectedObject;
		this.selectedElement = selectedObject;
		this.selectedNode.select();
		if (selectedObject instanceof XMLElement) {
			$("*:focus").blur();
		} else if (!(selectedObject instanceof XMLElementStub)) {
			this.selectedElement = selectedObject.parentElement;
			this.selectedNode.domNode.addClass("selected");
		} 
		
		this.editor.modifyMenu.refreshContextualMenus(this.selectedElement);
	}
	return this;
};

// Unselect the currently selected element or attribute
GUIEditor.prototype.deselect = function() {
	var selectedAttributes = $('.' + attributeContainerClass + ".selected");
	if (selectedAttributes.length > 0) {
		selectedAttributes.removeClass('selected');
		return this;
	}
	$("." + xmlNodeClass + ".selected").removeClass("selected");
	this.selectedNode = null;
	this.selectedElement = null;
	if (this.editor.modifyMenu != null)
		this.editor.modifyMenu.clearContextualMenus();
	return this;
};

// Delete the selected element or attribute
GUIEditor.prototype.deleteSelected = function() {
	if (this.selectedNode == null)
		return this;
	try {
		var selectedAttribute = this.selectedNode.getSelectedAttribute();
		if (selectedAttribute.length > 0) {
		this.selectAttribute(true);
		var newSelection = selectedAttribute.prev('.' + attributeContainerClass);
		if (newSelection.length == 0)
			newSelection = selectedAttribute.next('.' + attributeContainerClass);
			newSelection.addClass("selected");
			
			var xmlAttribute = selectedAttribute.data("xmlAttribute");
			xmlAttribute.remove();
			return this;
		}
	} catch(error) {
		// Attribute container undefined
	}
	if (this.selectedNode instanceof XMLElement) {
		this.deleteElement(this.selectedNode);
	} else {
		this.deleteText(this.selectedNode);
	}
	return this;
};

// Delete an element from the document and update the editor state
GUIEditor.prototype.deleteElement = function(xmlElement) {
	var parent = xmlElement.parentElement;
	var index = xmlElement.objectType.localName;
	if (!parent || !(parent instanceof XMLElement) || !parent.childCanBeRemoved(xmlElement.objectType))
		return;
	parent.childRemoved(xmlElement);
	var isSelected = xmlElement.isSelected();
	if (isSelected) {
		this.selectNode(this.afterDeleteSelection(xmlElement));
	} else if (parent.isSelected && parent != this.rootElement) {
		this.editor.modifyMenu.refreshContextualMenus(parent);
	}
	if (parent == this.rootElement) {
		this.editor.addTopLevelMenu.populate(this.rootElement);
	}
	xmlElement.remove();
	parent.updated({action : 'childRemoved', target : xmlElement});
	this.editor.xmlState.documentChangedEvent();
	return this;
};

GUIEditor.prototype.deleteText = function(xmlText) {
	var isSelected = xmlText.isSelected();
	if (isSelected) {
		this.selectNode(this.afterDeleteSelection(xmlText));
	}

	xmlText.remove();

	xmlText.parentElement.updated({action : 'textRemoved', target : xmlText});
	this.editor.xmlState.documentChangedEvent();
	return this;
};

GUIEditor.prototype.afterDeleteSelection = function(xmlNode) {
	var afterDeleteSelection = xmlNode.domNode.next("." + xmlNodeClass);
	if (afterDeleteSelection.length == 0)
		afterDeleteSelection = xmlNode.domNode.prev("." + xmlNodeClass);
	if (afterDeleteSelection.length == 0)
		afterDeleteSelection = xmlNode.domNode.parent().closest("." + xmlNodeClass);
	return afterDeleteSelection;
};

// Move the currently selected element by x number of positions
GUIEditor.prototype.moveSelected = function(up) {
	var selectedTextNode = $(".selected." + xmlTextClass);
	if (selectedTextNode.length > 0)
		return this.moveNode(selectedTextNode.data("xmlObject"), up);
	return this.moveNode(this.selectedNode, up);
};

// Move xmlObject by x number of positions
GUIEditor.prototype.moveNode = function(xmlObject, up) {
	if (xmlObject == null)
		return this;
	var result = up? xmlObject.moveUp() : xmlObject.moveDown();
	if (result) {
		this.editor.xmlState.documentChangedEvent();
		xmlObject.focus();
	}
	return this;
};

// Update an elements position in the XML document to reflect its position in the editor
GUIEditor.prototype.updateElementPosition = function(moved) {
	var movedElement = moved.data('xmlObject');

	if (movedElement.xmlNode) {
		var sibling = moved.prev('.' + xmlNodeClass);
		if (sibling.length == 0) {
			sibling = moved.next('.' + xmlNodeClass);
			movedElement.xmlNode.detach().insertBefore(sibling.data('xmlObject').xmlNode);
		} else {
			movedElement.xmlNode.detach().insertAfter(sibling.data('xmlObject').xmlNode);
		}
		this.editor.xmlState.documentChangedEvent();
	}
	
	this.selectNode(moved);
};

// Select the next or previous sibling element of the selected element
GUIEditor.prototype.selectSibling = function(reverse) {
	var direction = reverse? 'prev' : 'next';
	if (this.selectedNode.domNode.length > 0) {
		newSelection = this.selectedNode.domNode[direction]("." + xmlElementClass);
		if (newSelection.length == 0 && !this.selectedNode.isTopLevel) {
			// If there is no next sibling but the parent has one, then go to parents sibling
			this.selectedNode.domNode.parents("." + xmlElementClass).each(function(){
				newSelection = $(this)[direction]("." + xmlElementClass);
				if (newSelection.length > 0 || $(this).data("xmlObject").isTopLevel)
					return false;
			});
		}
	} else {
		if (!reverse)
			newSelection = $("." + xmlElementClass).first();
	}
	
	if (newSelection.length == 0)
		return this;
	this.selectNode(newSelection.first()).selectedNode.focus();
	return this;
};

// Select the parent of the currently selected element
GUIEditor.prototype.selectParent = function(reverse) {
	if (reverse)
		newSelection = this.selectedNode.domNode.find("." + xmlElementClass);
	else newSelection = this.selectedNode.domNode.parents("." + xmlElementClass);
	if (newSelection.length == 0)
		return this;
	this.selectNode(newSelection.first()).selectedNode.focus();
	return this;
};

// Select the next child of the currently selected element.  If it has no children,
// then select the next sibling if any are available.
GUIEditor.prototype.selectNext = function(reverse) {
	var newSelection = null;
	
	if (this.selectedNode == null) {
		if (!reverse)
			newSelection = $("." + xmlElementClass).first();
	} else {
		var found = false;
		var allElements = $("." + xmlElementClass + ":visible", this.xmlContent);
		
		if (reverse)
			allElements = $(allElements.get().reverse());
		
		var selectedNode = this.selectedNode;
		if (!(selectedNode instanceof XMLElement)) {
			selectedNode = selectedNode.parentElement;
		}

		allElements.each(function(){
			if (found) {
				newSelection = $(this);
				return false;
			} else if (this.id == selectedNode.domNodeID) {
				found = true;
			}
		});
	}
	
	if (newSelection != null)
		this.selectNode(newSelection.first()).selectedNode.focus();
	return this;
};

// Select the previous or next attribute of the selected element
GUIEditor.prototype.selectAttribute = function(reverse) {
	if (this.selectedNode == null) {
		return this;
	} else if (this.selectedNode instanceof XMLElement) {
		var selectedAttribute = this.selectedNode.getSelectedAttribute();
		if (selectedAttribute.length > 0) {
			var newSelection = selectedAttribute[reverse? 'prev' : 'next']("." + attributeContainerClass);
			if (newSelection.length > 0) {
				$("." + attributeContainerClass + ".selected").removeClass("selected");
				newSelection.addClass("selected");
			}
		} else {
			if (this.selectedNode.domNode){
				selectedAttribute = this.selectedNode.attributeContainer
						.children('.' + attributeContainerClass).first();
				selectedAttribute.addClass("selected");
			}
		}
	}
};

// Find and select the nearest element text field in an element or its children
GUIEditor.prototype.focusSelectedText = function() {
	if (this.selectedNode == null)
		return this;
	var focused = null;
	if (this.selectedNode.textInput != null) {
		focused = this.selectedNode.textInput.focus();
	} else {
		focused = this.selectedNode.domNode.find("input[type=text].element_text:visible, textarea.element_text:visible, select.element_text:visible").first().focus();
	}
	if (focused == null || focused.length == 0)
		return this;
	// If the focused input was in an element other than the selected one, then select it
	var containerElement = focused.parents("." + xmlElementClass);
	if (containerElement !== this.selectedNode)
		this.selectNode(containerElement);
	focused.focus();
	return this;
};

// Find and focus the nearest input field in the selected element or its children.  If the 
// input field focused belonged to a child, then select that child.
GUIEditor.prototype.focusInput = function(reverse) {
	var focused = $("input:focus, textarea:focus, select:focus, .edit_title:focus");
	if (focused.length == 0 && this.selectedNode == null) {
		if (reverse)
			return this;
		// Nothing is selected or focused, so grab the first available input
		focused = this.xmlContent.find("input[type=text]:visible, textarea:visible, select:visible, .edit_title:visible").first().focus();
	} else {
		// When an input is already focused, tabbing selects the next input
		var foundFocus = false;
		var inputsSelector = "input[type=text]:visible, textarea:visible, select:visible, .edit_title:visible";
		// If no inputs are focused but an element is selected, seek the next input near this element
		if (this.selectedNode != null && focused.length == 0) {
			inputsSelector += ", ." + xmlElementClass;
			focused = this.selectedNode.domNode;
		}
		var visibleInputs = this.xmlContent.find(inputsSelector);
		// If in reverse mode, get the previous input
		if (reverse) {
			visibleInputs = $(visibleInputs.get().reverse());
		}
		// Seek the next input after the focused one
		visibleInputs.each(function(){
			// Can't focus xml classes if they are present.
			if (foundFocus && !$(this).hasClass(xmlElementClass)) {
				focused = $(this).focus();
				return false;
			} else if (this === focused.get(0)) {
				foundFocus = true;
			}
		});
	}

	this.select(focused);
	return this;
};

// Return true if the given dom node is vertically completely on screen
GUIEditor.prototype.isCompletelyOnScreen = function(object) {
	var objectTop = object.offset().top;
	var objectBottom = objectTop + object.height();
	var docViewTop = $(window).scrollTop() + this.editor.editorHeader.height();
	var docViewBottom = docViewTop + $(window).height() - this.editor.editorHeader.height();

	return (docViewTop < objectTop) && (docViewBottom > objectBottom);
};

// If the given target is not completely on screen then scroll the window to the top of the target
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
 * Header bar with dropdown menus.  In addition to the default menu options, user provided
 * menus or options may be added as well.  Supports refreshing of menu items states via externally
 * defined updateFunctions
 */

function MenuBar(editor) {
	this.editor = editor;
	this.menuBarContainer = null;
	this.parentElement = null;
	// Functions which are executed when the menu is activated for updating the menu state
	this.updateFunctions = [];
	
	var self = this;
	var defaultSubmitConfig = null;
	$.each(self.editor.submitButtonConfigs, function(index, config) {
		if (config.url) {
			defaultSubmitConfig = config;
			return false;
		}
	});

	// Default menu entries
	this.headerMenuData = [ {
		label : 'File',
		enabled : true,
		action : function(event) {self.activateMenu(event);}, 
		items : [ {
				label : 'Submit to Server',
				enabled : defaultSubmitConfig != null,
				binding : "ctrl+alt+s",
				action : function() {
					self.editor.uploadXML.call(self.editor, defaultSubmitConfig);
				}
			}, {
				label : 'Export',
				enabled : (typeof(Blob) !== undefined),
				binding : "ctrl+alt+e",
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
		label : 'Insert',
		enabled : true,
		action : function(event) {self.activateMenu(event);}, 
		items : [ {
				label : 'Add attribute',
				enabled : true,
				binding : "alt+a",
				action : function(){
					var selected = self.editor.guiEditor.selectedElement;
					if (selected instanceof XMLElement)
						self.editor.addNode(selected, "attribute", false);
				}
			}, {
				label : 'Add element',
				enabled : true,
				binding : "enter",
				action : function(){
					var selected = self.editor.guiEditor.selectedElement;
					if (selected instanceof XMLElement) {
						self.editor.addNextElement(selected, false);
					}
				}
			}, {
				label : 'Add child element',
				enabled : true,
				binding : "alt+e",
				action : function(){
					var selected = self.editor.guiEditor.selectedElement;
					if (selected instanceof XMLElement)
						self.editor.addNode(selected, "element", false);
				}
			}, {
				label : 'Add sibling element',
				enabled : true,
				binding : "alt+s",
				action : function(){
					var selected = self.editor.guiEditor.selectedElement;
					if (selected)
						self.editor.addNode(selected.parentElement, "element", false, selected);
				}
			}, {
				label : 'Add element to parent',
				enabled : true,
				binding : "alt+p",
				action : function(){
					var selected = self.editor.guiEditor.selectedElement;
					if (selected)
						self.editor.addNode(selected.parentElement, "element", false);
				}
			}, {
				label : 'Add element to root',
				enabled : true,
				binding : "alt+r",
				action : function(){
					self.editor.addNode(self.editor.guiEditor.rootElement, "element", false);
				}
			}, {
				label : 'Add text to element',
				enabled : true,
				binding : "alt+t",
				action : function(){
					var selected = self.editor.guiEditor.selectedElement;
					if (selected)
						self.editor.addNode(selected, "text", false);
				}
			}, {
				label : 'Add comment to element',
				enabled : true,
				binding : "alt+/",
				action : function(){
					var selected = self.editor.guiEditor.selectedElement;
					if (selected)
						self.editor.addNode(selected, "comment", false);
				}
			}, {
				label : 'Add CDATA to element',
				enabled : true,
				binding : "alt+,",
				action : function(){
					var selected = self.editor.guiEditor.selectedElement;
					if (selected)
						self.editor.addNode(selected, "cdata", false);
				}
			} ]
	}, {
		label : 'View',
		enabled : true,
		action : function(event) {self.activateMenu(event);}, 
		items : [ {
			label : 'Switch to XML View',
			enabled : true,
			binding : "ctrl+alt+1",
			action : function() {
				self.editor.modeChange(0);
			}
		}, {
			label : 'Switch to Text View',
			enabled : true,
			binding : "ctrl+alt+2",
			action : function() {
				self.editor.modeChange(1);
			}
		} ]
	}, {
		label : 'Options',
		enabled : true,
		action : function(event) {self.activateMenu(event);}, 
		items : [ {
			label : 'Pretty XML Formatting',
			enabled : true,
			checked : self.editor.options.prettyXML,
			action : function() {
				self.editor.options.prettyXML = !self.editor.options.prettyXML;
				self.checkEntry(this, self.editor.options.prettyXML);
			}
		}, {
			label : 'Enable shortcut keys',
			enabled : true,
			checked : self.editor.options.enableGUIKeybindings,
			action : function() {
				self.editor.setEnableKeybindings(!self.editor.options.enableGUIKeybindings);
				self.checkEntry(this, self.editor.options.enableGUIKeybindings);
			}
		}, {
			label : 'Enforce min/max occurs',
			enabled : self.editor.options.enforceOccurs,
			checked : self.editor.options.enforceOccurs,
			action : function() {
				self.editor.options.enforceOccurs = !self.editor.options.enforceOccurs;
				self.editor.modifyMenu.refreshContextualMenus();
				self.checkEntry(this, self.editor.options.enforceOccurs);
			}
		}, {
			label : 'Prepend new elements',
			enabled : true,
			checked : self.editor.options.prependNewElements,
			action : function() {
				self.editor.options.prependNewElements = !self.editor.options.prependNewElements;
				self.checkEntry(this, self.editor.options.prependNewElements);
			}
		} ]
	}/*, {
		label : 'Help',
		enabled : true,
		action : function(event) {self.activateMenu(event);}, 
		items : [ {
			label : 'MODS Outline of Elements',
			enabled : true,
			binding : null,
			action : "http://www.loc.gov/standards/mods/mods-outline.html"
		} ]
	}*/, {
		label : self.editor.options.xmlEditorLabel,
		enabled : true, 
		itemClass : 'header_mode_tab',
		action : function() {
			self.editor.modeChange(0);
		}
	}, {
		label : self.editor.options.textEditorLabel,
		enabled : true, 
		itemClass : 'header_mode_tab',
		action : function() {
			self.editor.modeChange(1);
		}
	} ];
}

// Causes the targeted menu to be displayed, as well as triggering update functions
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
	$('html').one("click" ,function() {
		self.menuBarContainer.removeClass("active");
	});
	event.stopPropagation();
};

// Builds the menu and attaches it to the editor
MenuBar.prototype.render = function(parentElement) {
	this.parentElement = parentElement;
	this.menuBarContainer = $("<div/>").addClass(xmlMenuBarClass).appendTo(parentElement);
	
	this.headerMenu = $("<ul/>");
	this.menuBarContainer.append(this.headerMenu);
	this.initEventHandlers();
	
	var menuBar = this;
	$.each(this.headerMenuData, function() {
		menuBar.generateMenuItem(this, menuBar.headerMenu);
	});
};

MenuBar.prototype.initEventHandlers = function() {
	this.headerMenu.on("click", "li", { "menuBar" : this}, function(event) {
		var menuItem = $(this).data("menuItemData");
		if (menuItem.enabled && Object.prototype.toString.call(menuItem.action) == '[object Function]'){
			menuItem.action.call(this, event);
		}
	});
};

// Generates an individual menu entry
MenuBar.prototype.generateMenuItem = function(menuItemData, parentMenu) {
	var menuItem = $("<li/>").appendTo(parentMenu);
	var checkArea = $("<span/>").addClass("xml_menu_check").appendTo(menuItem);
		
	var menuItemLink = $("<a/>").appendTo(menuItem).html("<span>" + menuItemData.label + "</span>");
	if (menuItemData.binding) {
		menuItemLink.append("<span class='binding'>" + menuItemData.binding + "</span>");
	}
	// Entries with string actions are treated as hrefs
	if (menuItemData.action != null && Object.prototype.toString.call(menuItemData.action) != '[object Function]'){
		menuItemLink.attr({"href": menuItemData.action, "target" : "_blank"});
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
	
	if (menuItemData.checked)
		this.checkEntry(menuItem, true);
};

// Adds an additional menu entry to the menu.  An insertion path must be included in the entry
// if you wish to add to an existing menu, where the path is the label of the menu to add to
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


MenuBar.prototype.checkEntry = function(menuItem, checked) {
	var menuItem = $(menuItem);
	var menuItemData = menuItem.data("menuItemData");
	menuItemData.checked = checked;
	if (checked) {
		menuItem.find(".xml_menu_check").html("&#x2713;");
	} else {
		menuItem.find(".xml_menu_check").html("");
	}
};
/**
 * Menu object for adding new elements to an existing element or document
 */

function ModifyElementMenu(menuID, label, expanded, enabled, owner, editor, getRelativeToFunction) {
	this.menuID = menuID;
	this.label = label;
	// Header jquery element for this menu 
	this.menuHeader = null;
	// Refence to jquery object which contains the menu options
	this.menuContent = null;
	// Indicates if the menu can be interacted with
	this.enabled = enabled;
	// Indicates if the menu is collapsed or expanded
	this.expanded = expanded;
	// Optional function which determines what element to position newly added elements relative to
	this.getRelativeToFunction = getRelativeToFunction;
	// XMLElement object which will be modified by this menu
	this.target = null;
	this.owner = owner;
	this.editor = editor;
}

ModifyElementMenu.prototype.destroy = function() {
	if (this.menuHeader != null)
		this.menuHeader.remove();
	if (this.menuContent != null)
		this.menuContent.remove();
};

// Creates the structure for the menu, including headers and content areas.
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
	// Click handler for hiding/show the contents of the menu
	this.menuHeader.click(function(){
		if (!self.enabled) 
			return;
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
	// Add new child element click event
	this.menuContent.on('click', 'li', function(event){
		var relativeTo = (self.getRelativeToFunction)? 
				self.getRelativeToFunction($(this).data("xml").target) : null;
		var prepend = self.editor.options.prependNewElements;
		if (event.shiftKey) prepend = !prepend;
		self.owner.editor.addChildElementCallback(this, relativeTo, prepend);
	});
};

// Empty out the menu and collapse it
ModifyElementMenu.prototype.clear = function() {
	var startingHeight = this.menuContent.height();
	this.menuContent.empty();
	this.menuContent.css({height: startingHeight + "px"}).stop().animate({height: "0px"}, menuExpandDuration);
	this.target = null;
	this.enabled = false;
	this.menuHeader.addClass('disabled');
	return this;
};

// Populate the menu with entries for adding child elements of from the definition of the given XMLElement 
ModifyElementMenu.prototype.populate = function(xmlElement) {
	if (xmlElement == null || (this.target != null && xmlElement.domNode != null 
			&& this.target[0] === xmlElement.domNode[0]))
		return;
	
	if (this.expanded)
		this.menuContent.css("height", "auto");
	// Store the current height of the menu for use animating the height changes
	var startingHeight = this.menuContent.outerHeight();
	// Clear the previous menu contents
	this.menuContent.empty();
	
	// Store new target element for this menu
	this.target = xmlElement;
	var self = this;
	var parent = this.target;
	var choiceList = parent.objectType.choices;
	
	// Iterate through the child element definitions and generate entries for each
	if (this.target.objectType.elements) {
		$.each(this.target.objectType.elements, function(){
			var xmlElement = this;
			var elName = self.editor.xmlState.getNamespacePrefix(xmlElement.namespace) + xmlElement.localName;
			var addButton = $("<li/>").attr({
				title : 'Add ' + elName
			}).html(elName)
			.data('xml', {
					"target": self.target,
					"objectType": xmlElement
			}).appendTo(self.menuContent);
			// Disable the entry if its parent won't allow any more of this element type.
			if (!parent.childCanBeAdded(xmlElement))
				addButton.addClass('disabled');
		});
	}

	if (this.target.objectType.any) {
		$.each(this.editor.guiEditor.rootElement.objectType.elements, function() {
			var xmlElement = this;
			var elName = self.editor.xmlState.getNamespacePrefix(xmlElement.namespace) + xmlElement.localName;
			var addButton = $("<li/>").attr({
				title : 'Add ' + elName
			}).html(elName)
			.data('xml', {
					"target": self.target,
					"objectType": xmlElement
			}).appendTo(self.menuContent);
		});
	}
	
	if (this.expanded) {
		var endingHeight = this.menuContent.outerHeight() + 1;
		if (endingHeight == 0)
			endingHeight = 1;
		this.menuContent.css({height: startingHeight + "px"}).stop().animate({height: endingHeight + "px"}, menuExpandDuration).show();
	}

	// Disable or enable the menu depending on if it had any options added to it
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

	// Generate the document status panel, which shows a save/export button as well as if there are changes to the document
	if (this.editor.options.enableDocumentStatusPanel) {
		var self = this;
		var documentStatusPanel = $(self.editor.options.documentStatusPanelDomId);
		$("<span/>").addClass(submissionStatusClass).html("Document is unchanged")
			.appendTo(documentStatusPanel);

		if (self.editor.submitButtonConfigs != null){
			$.each(self.editor.submitButtonConfigs, function(index, config){
				var submitButton;
				if (config.id && ('createDomElement' in config) && !config.createDomElement) {
					submitButton = $("#" + config.id);
				} else {
					submitButton = $("<input/>").attr({
						id : config.id,
						'type' : 'button',
						'class' : config.cssClass || submitButtonClass,
						name : config.name || 'submit',
						value : config.label || 'Submit'
					}).appendTo(documentStatusPanel);
				}

				if (!('responseHandler' in config) && config.url) {
					config.responseHandler = config.responseHandler = self.editor.options.submitResponseHandler
						|| self.editor.swordSubmitResponseHandler;
				}

				submitButton.click(function() {
					self.editor.submitXML(config);
				});
			});
		}
		documentStatusPanel.appendTo(this.menuColumn);
	}

	this.menuContainer = $("<div class='" + menuContainerClass + "'/>").appendTo(this.menuColumn);
	this.menuContainer.css({'max-height': $(window).height(), 'overflow-y': 'auto'});
	return this;
};

// Add an additional menu for adding new elements to the panel
// menuID - id attribute for the menu
// label - display name for the menu
// expanded - whether to show the contents of the menu by default
// enabled - boolean indicating the menu can be interacted with
// contextual - Boolean indicating if this menu needs to be updated when selection changes
ModifyMenuPanel.prototype.addMenu = function(menuID, label, expanded, enabled, contextual,
		getRelativeToFunction) {
	var menu = new ModifyElementMenu(menuID, label, expanded, enabled, this, this.editor, getRelativeToFunction);
	this.menus[menuID] = {
			"menu" : menu,
			"contextual": contextual
		};
	menu.render(this.menuContainer);
	menu.initEventHandlers();
	return menu;
};

// Add a menu for adding new attributes
ModifyMenuPanel.prototype.addAttributeMenu = function(menuID, label, expanded, enabled, contextual) {
	if (arguments.length == 4)
		contextual = false;
	var menu = new AttributeMenu(menuID, label, expanded, enabled, this, this.editor);
	this.menus[menuID] = {
			"menu" : menu,
			"contextual": contextual
		};
	menu.render(this.menuContainer);
	menu.initEventHandlers();
	return menu;
};

ModifyMenuPanel.prototype.addNodeMenu = function(menuID, label, expanded, enabled) {
	var menu = new AddNodeMenu(menuID, label, expanded, enabled, this, this.editor);
	this.menus[menuID] = {
			"menu" : menu, 
			"contextual": true
		};
	menu.render(this.menuContainer);
	menu.initEventHandlers();
	return menu;
};

// Empty entries from all contextual menus
ModifyMenuPanel.prototype.clearContextualMenus = function() {
	$.each(this.menus, function(){
		if (this.contextual) {
			this.menu.clear();
		}
	});
	this.setMenuPosition();
	return this;
};

// Refresh entries for all contextual menus
ModifyMenuPanel.prototype.refreshContextualMenus = function(targetElement) {
	if (targetElement === undefined) {
		if (!this.targetElement)
			return this;
		targetElement = this.targetElement;
	} else this.targetElement = targetElement;
	$.each(this.menus, function(){
		if (this.contextual) {
			this.menu.populate(targetElement);
		}
	});
	this.setMenuPosition();
	return this;
};

// Update the position of the menu
ModifyMenuPanel.prototype.setMenuPosition = function(){
	if (this.menuColumn == null || this.menuColumn.offset() == null)
		return;

	var xmlWorkAreaContainer = this.editor.xmlWorkAreaContainer;
	var xmlEditorContainer = this.editor.xmlEditorContainer;
	var menuTop = xmlWorkAreaContainer.offset().top;
	if ($(window).scrollTop() >= menuTop) {
		this.menuColumn.css({
			position : 'fixed',
			left : xmlEditorContainer.offset().left + xmlEditorContainer.outerWidth() - this.menuColumn.innerWidth(),
			top : 0
		});
		this.editor.editorHeaderGroup.css({
			position : 'fixed',
			top : 0
		});
	} else {
		this.menuColumn.css({
			position : 'absolute',
			left : xmlEditorContainer.outerWidth() - this.menuColumn.innerWidth(),
			top : 0
		});
		this.editor.editorHeaderGroup.css({
			position : 'absolute',
			top : 0
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

NamespaceList.prototype.containsPrefix = function(nsPrefix) {
	return nsPrefix in this.namespaceURIs;
};

NamespaceList.prototype.getNamespacePrefix = function(nsURI) {
	if (!nsURI) {
		return "";
	}

	var prefix = this.namespaceToPrefix[nsURI];
	if (prefix)
		prefix += ":";
	return prefix;
};
/**
 * Unpacks the elements of the schema object into structures to accomodate lookup
 * of definitions by name and position within the schema hierarchy.
 */

function SchemaTree(rootElement) {
	// Map of elements stored by name.  If there are name collisions, then elements are stored in a list
	this.nameToDef = {};
	// Root of the schema tree
	this.rootElement = rootElement;
	// Store namespaces from the schema in a schema specific namespace list
	this.namespaceIndexes = this.rootElement.namespaces;
	this.namespaces = new NamespaceList();
	for (var index in this.namespaceIndexes) {
		var def = this.namespaceIndexes[index];
		this.namespaces.addNamespace(def.uri, def.prefix);
	}
}

// Recursively walk the provided schema to construct necessary representations of the tree for the editord
SchemaTree.prototype.build = function(elementName, elementDef, parentDef) {
	// Default to the root element if no element is given.
	if (arguments.length == 0) {
		elementName = this.rootElement.ns + ":" + this.rootElement.name;
		elementDef = this.rootElement;
		parentDef = null;
	}
	
	// Store a reference from this instance of an element back to the current parent.
	// These are needed to assist in disambiguating when multiple definitions share a name in a namespace
	if ("parents" in elementDef) {
		// Definition already has a parent, so add parent reference and return to avoid loop
		elementDef.parents.push(parentDef);
		return;
	} else {
		elementDef["parents"] = [parentDef];
	}
	
	var namespaceDefinition = this.namespaceIndexes[elementDef.ns];
	//Resolve namespace index into actual namespace uri
	elementDef.namespace = namespaceDefinition.uri;
	// Split element name into localName and prefixed name
	if (!elementDef.schema) {
		elementDef.localName = elementDef.name;
		elementDef.name = (namespaceDefinition.prefix? namespaceDefinition.prefix + ":" : "") + elementDef.localName;
	}
	
	// Add this definition to the map of elements.  If there is a name collision, store the 
	// elements with overlapping names together in a list
	var definitionList = this.nameToDef[elementName];
	if (definitionList == null) {
		this.nameToDef[elementName] = [elementDef];
	} else {
		this.nameToDef[elementName].push(elementDef);
	}
	
	var self = this;
	// Expand namespaces and names of attributes available to this element
	if (elementDef.attributes)
		$.each(elementDef.attributes, function() {
			if (this.localName)
				return true;
			this.localName = this.name;
			var namespaceDefinition = self.namespaceIndexes[this.ns];
			this.namespace = namespaceDefinition.uri;
			this.name = (namespaceDefinition.prefix? namespaceDefinition.prefix + ":" : "") + this.localName;
		});
	// Call build on all the child elements of this element to continue the walk.
	$.each(elementDef.elements, function() {
		self.build(this.ns + ":" + this.name, this, elementDef);
	});
};

// Retrieves the schema definition the provided element node.  If more than one definition is
// found for the element by name and namespace, then attempts to disambiguate by parents
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

// Returns true if all the ancestors of the provided element match all the ancestors
// defined for this element in the schema
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
			if (parentDef.localName == localName(parentNode) && parentDef.namespace == parentNode.namespaceURI) {
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
	var prefix = this.editor.xmlState.getNamespacePrefix(newElement.objectType.namespace);
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
/**
 * Manages the history of changes that have occurred, to allow progression forward
 * or backward through a limited history of modifications to the xml document
 * Current implementation involves storing previous states of the XML document,
 * recorded each time a significant change occurs or the document is regenerated
 */

function UndoHistory(xmlState, editor) {
	this.xmlState = xmlState;
	this.editor = editor;
	// History of document states
	this.states = [];
	// Index of the currently active history state
	this.headIndex = -1;
	// Callback triggered after a change is undone or redone
	this.stateChangeEvent = null;
	// Callback triggered after a new state is added to the history
	this.stateCaptureEvent = null;
	// Disable undo history if the browser doesn't support cloning documents
	this.disabled = (typeof(document.implementation.createDocument) == "undefined");
}

UndoHistory.prototype.setStateChangeEvent = function(event) {
	this.stateChangeEvent = event;
	return this;
};

UndoHistory.prototype.setStateCaptureEvent = function(event) {
	this.stateCaptureEvent = event;
	return this;
};

// Clones an XML document and returns the new document
UndoHistory.prototype.cloneNewDocument = function(originalDoc) {
	if (this.disabled) return;
	var newDoc = originalDoc.implementation.createDocument(
		originalDoc.namespaceURI, null, null
	);
	var newNode = newDoc.importNode(originalDoc.documentElement, true);
	newDoc.appendChild(newNode);
	return $(newDoc);
};

// Move the current active document to a different version from the history.
// The step parameter indicates how many versions to move, and determines the direction to 
// move as well, where a negative number will undo changes, and a positive will redo.
UndoHistory.prototype.changeHead = function(step){
	if (this.disabled) return;
	if ((step < 0 && this.headIndex + step < 0) 
			|| (step > 0 && this.headIndex + step >= this.states.length
			||  this.headIndex + step >= this.editor.options.undoHistorySize))
		return;
	
	this.headIndex += step;
	// Clone the newly selected document head, otherwise this state would be lost from 
	// the history when any new changes were made
	this.xmlState.xml = this.cloneNewDocument(this.states[this.headIndex][0]);
	
	if (this.stateChangeEvent != null)
		this.stateChangeEvent(this);
};

// Capture the current state of the XML document into the document history
UndoHistory.prototype.captureSnapshot = function () {
	if (this.disabled) return;
	if (this.editor.options.undoHistorySize <= 0)
		return;
	
	if (this.headIndex < this.states.length - 1) {
		this.states = this.states.slice(0, this.headIndex + 1);
	}
	
	if (this.states.length >= this.editor.options.undoHistorySize) {
		this.states = this.states.slice(1, this.states.length);
	}

	this.headIndex = this.states.length;

	this.states.push(this.cloneNewDocument(this.xmlState.xml[0]));
	
	if (this.stateCaptureEvent != null)
		this.stateCaptureEvent(this);
};
/**
 * Stores data representing a single attribute for an element
 */

function XMLAttribute(objectType, xmlElement, editor) {
	AbstractXMLObject.call(this, objectType, editor);
	// the XMLElement object which this attribute belongs to.
	this.xmlElement = xmlElement;

	this.attributeInput = null;
	// The menu button associated with this attribute.  Used for reenabling attribute in menu on remove
	// TODO replace this with a more general solution
	this.addButton = null;

	var prefix;
	this.attributeName = objectType.localName;
	// Determine whether the attribute name should include a namespace prefix
	if (this.xmlElement.objectType.namespace != this.objectType.namespace) {
		prefix = this.editor.xmlState.getNamespacePrefix(this.objectType.namespace);
		this.attributeName = prefix + this.attributeName;
	}
}

XMLAttribute.prototype.constructor = XMLAttribute;
XMLAttribute.prototype = Object.create( AbstractXMLObject.prototype );

// Render the gui representation of this attribute
XMLAttribute.prototype.render = function (){
	if (!this.xmlElement.domNode)
		return;

	this.domNodeID = this.xmlElement.domNodeID + "_" + this.objectType.ns + "_" + this.objectType.localName;
	
	this.domNode = $("<div/>").attr({
		'id' : this.domNodeID + "_cont",
		'class' : attributeContainerClass
	}).data('xmlAttribute', this).appendTo(this.xmlElement.getAttributeContainer());
	
	var self = this;
	var removeButton = document.createElement('a');
	removeButton.appendChild(document.createTextNode('(x) '));
	this.domNode[0].appendChild(removeButton);
	
	var label = document.createElement('label');
	var prefix = this.editor.xmlState.namespaces.getNamespacePrefix(this.objectType.namespace);
	label.appendChild(document.createTextNode(prefix + this.objectType.localName));
	this.domNode[0].appendChild(label);
	
	var attributeValue = this.xmlElement.xmlNode.attr(this.attributeName);
	if (attributeValue == '' && this.objectType.defaultValue != null) {
		attributeValue = this.objectType.defaultValue;
	}
	
	this.attributeInput = this.createElementInput(this.domNodeID.replace(":", "-"), attributeValue, this.domNode[0]);
	this.attributeInput.data('xmlAttribute', this);
	
	return this.attributeInput;
};

XMLAttribute.prototype.remove = function() {
	// Tell the button associated with this attribute that it was removed.  Replace this
	if ($("#" + this.domNodeID).length > 0) {
		if (this.addButton != null){
			this.addButton.removeClass("disabled");
		}
	}
	this.xmlElement.removeAttribute(this.objectType);
	this.domNode.remove();
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
	this.editor.guiEditor.selectNode(this.xmlElement);
	this.domNode.addClass("selected");
	this.attributeInput.focus();
};

XMLAttribute.prototype.deselect = function() {
	this.domNode.removeClass('selected');
};
function XMLAttributeStub(xmlElement, editor) {
	this.objectType = {
		attrStub : true
	};
	this.editor = editor;
	this.guiEditor = this.editor.guiEditor;
	// dom element header for this element
	this.elementHeader = null;
	this.tagName = "";

	this.xmlElement = xmlElement;

	this.nameInput = null;
}

XMLAttributeStub.prototype.render = function() {
	this.domNodeID = "attr_stub_" + this.guiEditor.nextIndex();
	
	this.domNode = $("<div/>").attr({
		'id' : this.domNodeID + "_cont",
		'class' : attributeContainerClass + " xml_attr_stub"
	}).data('xmlAttribute', this).appendTo(this.xmlElement.getAttributeContainer());
	
	var self = this;
	var removeButton = document.createElement('a');
	removeButton.appendChild(document.createTextNode('(x) '));
	this.domNode[0].appendChild(removeButton);
	
	this.nameInput = document.createElement('label');
	this.nameInput.className = "edit_title";
	this.nameInput.setAttribute("contenteditable", "true");
	this.domNode[0].appendChild(this.nameInput);
	this.nameInput = $(this.nameInput);

	var createLink = $("<span class='create_attr'>create attribute</span>").appendTo(this.domNode).mouseup(function(e){
		self.create();
	});

	stubNameInput.call(this, this.nameInput, this.xmlElement.objectType.attributes,
		$.proxy(this.xmlElement.attributeExists, this.xmlElement));
	
	return this.domNode;
};

XMLAttributeStub.prototype.remove = function() {
	this.domNode.remove();
};

XMLAttributeStub.prototype.create = function() {
	var attrName = this.nameInput.text();
	var newAttr = this.editor.addAttribute(this.xmlElement, attrName);

	if (newAttr instanceof AbstractXMLObject) {
		this.remove();
	} else {
		console.log(newAttr);
	}
};

XMLAttributeStub.prototype.select = function() {
	this.domNode.addClass("selected");
};

XMLAttributeStub.prototype.deselect = function() {
	this.domNode.removeClass('selected');
};

XMLAttributeStub.prototype.isSelected = function() {
	return this.domNode.hasClass("selected");
};

XMLAttributeStub.prototype.focus = function() {
	this.nameInput.focus();
};
$.widget( "custom.xml_autocomplete", $.ui.autocomplete, {
    messages: {
        noResults: '',
        results: function() {}
    },

	_create: function() {
		this._super();
		this.menu.element.addClass("xml_autocomplete");
	},

	_resizeMenu: function() {
		var matchWidth = this.options.matchSize.outerWidth();
		this.menu.element.outerWidth(matchWidth);
	},

	_renderMenu: function( ul, items ) {
		var self = this;
		var validItemFunction = this.options.validItemFunction;

		// Sort suggestions by proximity of search term to the beginning of the item
		var rankMap = [];
		$.each(items, function(index, item) {
			if (validItemFunction && validItemFunction(item.value))
				return true;
			rankMap.push([item.value.toLowerCase().indexOf(self.term.toLowerCase()), item]);
		});

		if (rankMap.length == 0) {
			this.close();
			return;
		}

		rankMap.sort(function(a, b) {
			return a[0] - b[0];
		});

		$.each(rankMap, function(index, item) {
			self._renderItemData(ul, item[1]);
		});
	},

	_renderItem : function(ul, item) {
		var re = new RegExp("((" + this.term + ")+)");
		var label = item.label.replace(re, "<span>$1</span>");
		return $("<li></li>")
			.data("item.autocomplete", item)
			.append("<a>" + label + "</a>")
			.appendTo(ul);
	},

	_move: function( direction, event ) {
		this._super(direction, event);
		this._resizeMenu();
	}
});
function XMLCDataNode(cdataNode, editor) {
	var nodeType = {
		cdata : true,
		type : "cdata"
	};

	XMLTextNode.call(this, cdataNode, nodeType, editor);

	this.objectType = nodeType;
}

XMLCDataNode.prototype.constructor = XMLCDataNode;
XMLCDataNode.prototype = Object.create( XMLTextNode.prototype );

XMLCDataNode.prototype.addXmlNode = function(prepend) {
	var textValue = "";
	if (!this.textNode) {
		var parentNode = this.parentElement.xmlNode;
		this.textNode = parentNode[0].ownerDocument.createCDATASection("");
		if (prepend) {
			parentNode.prepend(this.textNode);
		} else {
			parentNode[0].appendChild(this.textNode);
		}
		this.xmlNode = $(this.textNode);
	} else {
		textValue = this.textNode.nodeValue;
	}
	return textValue;
};

XMLCDataNode.prototype.render = function(parentElement, prepend) {
	XMLTextNode.prototype.render.call(this, parentElement, prepend);
	this.domNode.addClass("xml_cdata_node");

	var header = document.createElement('label');
	header.className = 'xml_type_header';
	header.appendChild(document.createTextNode('CDATA'));
	$(header).attr("for", this.domNodeID + "_text");

	this.domNode.children(".xml_input_column").prepend(header);
};

// Persist the input value back into the text node
XMLCDataNode.prototype.syncText = function() {
	XMLTextNode.prototype.syncText.call(this);
};

XMLCDataNode.prototype.remove = function() {
	AbstractXMLObject.prototype.remove.call(this);
};

XMLCDataNode.prototype.select = function() {
	XMLTextNode.prototype.select.call(this);
};

XMLCDataNode.prototype.swap = function(swapTarget) {
	AbstractXMLObject.prototype.swap.call(this, swapTarget);
};

XMLCDataNode.prototype.moveUp = function() {
	AbstractXMLObject.prototype.moveUp.call(this);
};

XMLCDataNode.prototype.moveDown = function() {
	AbstractXMLObject.prototype.moveDown.call(this);
};

XMLCDataNode.prototype.focus = function() {
	AbstractXMLObject.prototype.focus.call(this);
};

XMLCDataNode.prototype.isSelected = function() {
	return AbstractXMLObject.prototype.isSelected.call(this);
};
function XMLCommentNode(cdataNode, editor) {
	var nodeType = {
		comment : true,
		type : "comment"
	};

	XMLTextNode.call(this, cdataNode, nodeType, editor);

	this.objectType = nodeType;
}

XMLCommentNode.prototype.constructor = XMLCommentNode;
XMLCommentNode.prototype = Object.create( XMLTextNode.prototype );

XMLCommentNode.prototype.addXmlNode = function(prepend) {
	var textValue = "";
	if (!this.textNode) {
		var parentNode = this.parentElement.xmlNode;
		this.textNode = parentNode[0].ownerDocument.createComment("");
		if (prepend) {
			parentNode.prepend(this.textNode);
		} else {
			parentNode[0].appendChild(this.textNode);
		}
		this.xmlNode = $(this.textNode);
	} else {
		textValue = this.textNode.nodeValue;
	}
	return textValue;
};

XMLCommentNode.prototype.render = function(parentElement, prepend) {
	XMLTextNode.prototype.render.call(this, parentElement, prepend);
	this.domNode.addClass("xml_comment_node");

	var header = document.createElement('label');
	header.className = 'xml_type_header';
	header.appendChild(document.createTextNode('comment'));
	$(header).attr("for", this.domNodeID + "_text");

	this.domNode.children(".xml_input_column").prepend(header);
};

// Persist the input value back into the text node
XMLCommentNode.prototype.syncText = function() {
	XMLTextNode.prototype.syncText.call(this);
};

XMLCommentNode.prototype.remove = function() {
	AbstractXMLObject.prototype.remove.call(this);
};

XMLCommentNode.prototype.select = function() {
	XMLTextNode.prototype.select.call(this);
};

XMLCommentNode.prototype.swap = function(swapTarget) {
	AbstractXMLObject.prototype.swap.call(this, swapTarget);
};

XMLCommentNode.prototype.moveUp = function() {
	AbstractXMLObject.prototype.moveUp.call(this);
};

XMLCommentNode.prototype.moveDown = function() {
	AbstractXMLObject.prototype.moveDown.call(this);
};

XMLCommentNode.prototype.focus = function() {
	AbstractXMLObject.prototype.focus.call(this);
};

XMLCommentNode.prototype.isSelected = function() {
	return AbstractXMLObject.prototype.isSelected.call(this);
};
/**
 * Stores data related to a single xml element as it is represented in both the base XML 
 * document and GUI
 */

function XMLElement(xmlNode, objectType, editor) {
	AbstractXMLObject.call(this, objectType, editor);
	// jquery object reference to the xml node represented by this object in the active xml document
	this.xmlNode = $(xmlNode);
	this.isRootElement = this.xmlNode[0].parentNode === this.xmlNode[0].ownerDocument;
	// Flag indicating if this element is a child of the root node
	this.isTopLevel = this.xmlNode[0].parentNode.parentNode === this.xmlNode[0].ownerDocument;
	// Flag indicating if any children nodes can be added to this element
	this.allowChildren = this.objectType.elements.length > 0 || this.objectType.any;
	// Flag indicating if any attributes can be added to this element
	this.allowAttributes = this.objectType.anyAttribute || (this.objectType.attributes && this.objectType.attributes.length > 0);
	// Should this element allow text nodes to be added
	this.allowText = this.objectType.type != null;
	// dom element header for this element
	this.elementHeader = null;
	// dom element which contains the display of child nodes
	this.nodeContainer = null;
	// Counter for total number of immediate children of this element
	this.nodeCount = 0;
	// dom element for attributes
	this.attributeContainer = null;
	// Counter for number of attributes assigned to this element
	this.attributeCount = 0;
	// Map of child element type counts, used for constraining number of each type of child element
	this.presentChildren = {};
	// Array of element counts belonging to each choice block on this element definition
	// Order of counts matches the order of choice blocks from the schema definition
	this.choiceCount = [];
}

XMLElement.prototype.constructor = XMLElement;
XMLElement.prototype = Object.create( AbstractXMLObject.prototype );

// Render the GUI view of this element and all of its subelements/attributes
// parentElement - the XMLElement parent of this element
// recursive - Boolean which indicates whether to render this elements subelements
// Returns the newly created GUI dom element
XMLElement.prototype.render = function(parentElement, recursive, relativeTo, prepend) {
	this.parentElement = parentElement;
	this.domNodeID = this.guiEditor.nextIndex();
	
	// Create the element and add it to the container
	this.domElement = document.createElement('div');
	this.domNode = $(this.domElement);

	this.domElement.id = this.domNodeID;
	this.domElement.className = this.objectType.localName + "_" + this.objectType.ns  + 'Instance ' + xmlNodeClass + ' ' + xmlElementClass;
	if (this.isTopLevel)
		this.domElement.className += ' ' + topLevelContainerClass;
	if (this.isRootElement)
		this.domElement.className += ' xml_root_element';
	
	this.insertDOMNode(relativeTo, prepend);
	
	// Begin building contents
	this.elementHeader = document.createElement('ul');
	this.elementHeader.className = 'element_header';
	this.domElement.appendChild(this.elementHeader);
	var elementNameContainer = document.createElement('li');
	elementNameContainer.className = 'element_name';
	this.elementHeader.appendChild(elementNameContainer);

	if (this.objectType.schema)
		this.elementName = this.xmlNode[0].tagName;
	else {
		this.elementName = this.editor.xmlState.getNamespacePrefix(this.objectType.namespace) 
		+ this.objectType.localName;
	}
	
	// set up element title and entry field if appropriate
	var titleElement = document.createElement('span');
	titleElement.appendChild(document.createTextNode(this.elementName));
	elementNameContainer.appendChild(titleElement);
	
	// Switch gui element over to a jquery object
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

XMLElement.prototype.insertDOMNode = function (relativeTo, prepend) {
	if (this.parentElement) {
		if (relativeTo) {
			if (prepend)
				this.domNode.insertBefore(relativeTo.domNode);
			else
				this.domNode.insertAfter(relativeTo.domNode);
		} else {
			if (prepend)
				this.parentElement.nodeContainer.prepend(this.domNode);
			else
				this.parentElement.nodeContainer[0].appendChild(this.domElement);
		}
	}
};

// Render all present attributes for this elements
XMLElement.prototype.renderAttributes = function () {
	var self = this;
	var attributesArray = this.objectType.attributes;
	if (!attributesArray)
		return;
	
	$(this.xmlNode[0].attributes).each(function() {
		var attrNamespace = this.namespaceURI? this.namespaceURI : self.objectType.namespace;
		var attrLocalName = self.editor.stripPrefix(this.nodeName);
		for ( var i = 0; i < attributesArray.length; i++) {
			if (attributesArray[i].localName == attrLocalName && attributesArray[i].namespace == attrNamespace) {
				var attribute = new XMLAttribute(attributesArray[i], self, self.editor);
				attribute.render();
				return;
			}
		}
	});
};

// Updates child count tracking for the given element
XMLElement.prototype.addChildrenCount = function(childElement) {
	this.updateChildrenCount(childElement, 1);
};

// Inform element that a specific child element has been removed
XMLElement.prototype.childRemoved = function(childElement) {
	this.updateChildrenCount(childElement, -1);
};

/**
 * Updates child occurrence counts in response to a newly added child element
 */
XMLElement.prototype.updateChildrenCount = function(childElement, delta) {
	var self = this;
	this.nodeCount += delta;
	var childName = childElement.objectType.ns + ":" + childElement.objectType.localName;
	var choiceList = self.objectType.choices;
	// Update child type counts
	if (self.presentChildren[childName])
		self.presentChildren[childName] += delta;
	else
		self.presentChildren[childName] = delta > 0? delta : 0;
	if (choiceList) {
		for (var i = 0; i < choiceList.length; i++) {
			if ($.inArray(childName, choiceList[i].elements) > -1) {
				if (self.choiceCount[i])
					self.choiceCount[i] += delta;
				else
					self.choiceCount[i] = delta > 0? delta : 0;
			}
		}
	}
	
	return;
};

// Returns true if any more children of type childType can be added to this element
XMLElement.prototype.childCanBeAdded = function(childType) {
	if (!this.allowChildren)
		return false;
	
	// Verify that this new child definition would not violate occurrance limits
	if (!this.editor.options.enforceOccurs) return true;
	var childName = childType.ns + ":" + childType.localName;
	var presentCount = this.presentChildren[childName] || 0;
	// For the moment, if occur is not set, then pretend its unbound until the other limits are implemented
	// Normally, this should be defaulting to 1
	var maxOccurs = this.objectType.occurs && childName in this.objectType.occurs? 
			this.objectType.occurs[childName].max : "unbounded";
	if (maxOccurs != null && maxOccurs != 'unbounded' && presentCount >= maxOccurs)
		return false;
	
	// Check choices list to see if there are any choice restrictions on this type
	var choiceList = this.objectType.choices;
	if (choiceList) {
		for (var i = 0; i < choiceList.length; i++) {
			if ($.inArray(childName, choiceList[i].elements) > -1) {
				var choiceCount = this.choiceCount[i] || 0;
				if (choiceList[i].maxOccurs && choiceCount >= choiceList[i].maxOccurs)
					return false;
			}
		}
	}
	
	return true;
};

// Returns true if an element of definition childType can be removed from this element, according to
// minimum occurrence restrictions
XMLElement.prototype.childCanBeRemoved = function(childType) {
	if (!this.editor.options.enforceOccurs) return true;
	// Not checking min for groups or choices to avoid irreplaceable children
	var childName = childType.ns + ":" + childType.localName;
	if (this.presentChildren[childName] && this.objectType.occurs && childName in this.objectType.occurs)
		return (this.presentChildren[childName] > this.objectType.occurs[childName].min);
	return true;
};

// Populate the minimum number of children needed for this element to be valid
XMLElement.prototype.populateChildren = function() {
	if (!this.editor.options.enforceOccurs) return;
	var self = this;
	$.each(this.objectType.elements, function(){
		var childName = this.ns + ":" + this.localName;
		if (self.objectType.occurs && childName in self.objectType.occurs) {
			var minOccurs = self.objectType.occurs[childName].min;
			if (minOccurs) {
				for (var i = 0; i < minOccurs; i++) {
					var childElement = self.addElement(this);
					self.editor.activeEditor.addElementEvent(self, childElement);
				}
			}
		}
	});
};

XMLElement.prototype.initializeGUI = function () {
	var self = this;
	if (this.nodeContainer != null) {
		// Enable sorting of this element's child nodes
		this.nodeContainer.sortable({
			distance: 10,
			items: '> .' + xmlNodeClass,
			update: function(event, ui) {
				self.editor.guiEditor.updateElementPosition($(ui.item));
			}
		});
	}
};

// Generate buttons for performing move and delete actions on this element
XMLElement.prototype.addTopActions = function () {
	var self = this;
	var topActionSpan = document.createElement('li');
	topActionSpan.className = 'top_actions';
	
	this.toggleCollapse = document.createElement('span');
	this.toggleCollapse.className = 'toggle_collapse';
	this.toggleCollapse.id = this.guiElementID + '_toggle_collapse';
	this.toggleCollapse.appendChild(document.createTextNode('_'));
	topActionSpan.appendChild(this.toggleCollapse);
	
	var moveDown = document.createElement('span');
	moveDown.className = 'move_down';
	moveDown.id = this.domNodeID + '_down';
	moveDown.appendChild(document.createTextNode('\u2193'));
	topActionSpan.appendChild(moveDown);
	
	var moveUp = document.createElement('span');
	moveUp.className = 'move_up';
	moveUp.id = this.domNodeID + '_up';
	moveUp.appendChild(document.createTextNode('\u2191'));
	topActionSpan.appendChild(moveUp);
	
	var deleteButton = document.createElement('span');
	deleteButton.className = 'xml_delete';
	deleteButton.id = this.domNodeID + '_del';
	deleteButton.appendChild(document.createTextNode('X'));
	topActionSpan.appendChild(deleteButton);
	
	return topActionSpan;
};

// Generates GUI containers for the content panels of this element, including children elements,
// attributes and text
XMLElement.prototype.addContentContainers = function (recursive) {
	var attributesArray = this.objectType.attributes;
	var elementsArray = this.objectType.elements;

	this.contentContainer = document.createElement("div");
	this.domElement.appendChild(this.contentContainer);
	
	var placeholder = document.createElement('div');
	placeholder.className = 'placeholder';

	if (this.allowText) {
		if (this.allowAttributes) {
			if (this.allowChildren) {
				placeholder.appendChild(document.createTextNode('Use the menu to add subelements, attributes and text.'));
			} else {
				placeholder.appendChild(document.createTextNode('Use the menu to add attributes and text.'));
			}
		} else if (this.allowChildren) {
			placeholder.appendChild(document.createTextNode('Use the menu to add subelements and text.'));
		} else {
			placeholder.appendChild(document.createTextNode('Use the menu to add text.'));
		}
	} else {
		if (this.allowAttributes) {
			if (this.allowChildren) {
				placeholder.appendChild(document.createTextNode('Use the menu to add subelements and attributes.'));
			} else {
				placeholder.appendChild(document.createTextNode('Use the menu to add attributes.'));
			}
		} else if (this.allowChildren) {
			placeholder.appendChild(document.createTextNode('Use the menu to add subelements.'));
		}
	}

	this.contentContainer.appendChild(placeholder);
	this.placeholder = $(placeholder);
	
	if (attributesArray && attributesArray.length > 0) {
		this.addAttributeContainer();
	}

	this.addNodeContainer(recursive);
};

XMLElement.prototype.addNodeContainer = function (recursive) {
	var container = document.createElement('div');
	container.id = this.domNodeID + "_cont_nodes";
	container.className = 'content_block xml_children';
	this.nodeContainer = $(container);
	this.contentContainer.appendChild(container);

	this.nodeCount = 0;

	var textContainsChildren = this.xmlNode[0].children && this.xmlNode[0].children.length > 0;

	var childNodes = this.xmlNode[0].childNodes;
	for (var i in childNodes) {
		var childNode = childNodes[i];

		switch (childNode.nodeType) {
			case 1 : // element
				this.renderChild(childNode, recursive);
				break;
			case 3 : // text
				if (this.allowText && childNode.nodeValue.trim())
					this.renderText(childNode);
				break;
			case 4 : // cdata
				this.renderCData(childNode);
				break;
			case 8 : // comment
				this.renderComment(childNode);
				break;
		}
	}

	// Add in a default text node if applicable and none present
	if (this.allowText && this.nodeCount == 0 &&
			(this.objectType.type != "mixed" || !this.objectType.any)) {
		this.renderText();
	}
};

// Render children elements
// recursive - if false, then only the immediate children will be rendered
XMLElement.prototype.renderChild = function(childNode, recursive) {
	
	var elementsArray = this.objectType.elements;

	if (elementsArray) {
		for ( var i = 0; i < elementsArray.length; i++) {
			var prefix = this.editor.xmlState.getNamespacePrefix(elementsArray[i].namespace);
			if (prefix + elementsArray[i].localName == childNode.nodeName) {
				var childElement = new XMLElement($(childNode), elementsArray[i], this.editor);
				childElement.render(this, recursive);
				this.addChildrenCount(childElement);
				return;
			}
		}
	}

	// Handle children that do not have a definition
	var childElement = new XMLUnspecifiedElement($(childNode), this.editor);
	childElement.render(this, recursive);
	this.addChildrenCount(childElement);
};

XMLElement.prototype.renderText = function(childNode, prepend) {
	var textNode = new XMLTextNode(childNode, this.objectType.type, this.editor);
	textNode.render(this, prepend);

	this.nodeCount++;

	return textNode;
};

XMLElement.prototype.getTextInputs = function() {
	var textNodes = this.nodeContainer.children("." + xmlTextClass);
	var textInputs = []
	for (var i = 0; i < textNodes.length; i++) {
		var textNode = textNodes.eq(i);
		var nodeObject = textNode.data("xmlObject");
		textInputs.push(nodeObject.textInput);
	}

	return $(textInputs);
};

XMLElement.prototype.renderCData = function(childNode, prepend) {
	var cdataNode = new XMLCDataNode(childNode, this.editor);
	cdataNode.render(this, prepend);

	this.nodeCount++;

	return cdataNode;
};

XMLElement.prototype.renderComment = function(childNode, prepend) {
	var node = new XMLCommentNode(childNode, this.editor);
	node.render(this, prepend);

	this.nodeCount++;

	return node;
};

XMLElement.prototype.renderElementStub = function(prepend, relativeTo) {
	var node = new XMLElementStub(this.editor);
	node.render(this, prepend, relativeTo);

	this.nodeCount++;

	return node;
};

XMLElement.prototype.renderAttributeStub = function() {
	var node = new XMLAttributeStub(this, this.editor);
	node.render();

	this.attributeCount++;

	return node;
};

XMLElement.prototype.addAttributeContainer = function () {
	var container = document.createElement('div');
	container.id = this.domNodeID + "_cont_attributes";
	container.className = "content_block " + attributesContainerClass;
	this.contentContainer.appendChild(container);
	this.attributeContainer = $(container);

	this.renderAttributes();
};

// Add a child element of type objectType and update the interface
XMLElement.prototype.addNonschemaElement = function(tagName, relativeTo, prepend) {

	var xmlDocument = this.editor.xmlState.xml[0];
	var newElement;
	try {
		newElement = xmlDocument.createElement(tagName);
	} catch(e) {
		// Name was probably invalid
		return null;
	}

	this.insertXMLNode(newElement, relativeTo, prepend);

	var childElement = new XMLUnspecifiedElement(newElement, this.editor);
	this.addChildrenCount(childElement);
	if (this.domNode != null)
		childElement.render(this, true, relativeTo, prepend);
	
	return childElement;

};

// Add a child element of type objectType and update the interface
XMLElement.prototype.addElement = function(objectType, relativeTo, prepend) {
	var prefix = this.editor.xmlState.getNamespacePrefix(objectType.namespace);
	
	// Create the new element in the target namespace with the matching prefix
	var xmlDocument = this.editor.xmlState.xml[0];
	var defaultValue = null;
	if (objectType.values && objectType.values.length > 0)
		defaultValue = objectType.values[0];
	var newElement;
	if (xmlDocument.createElementNS) {
		newElement = xmlDocument.createElementNS(objectType.namespace, prefix + objectType.localName);
	} else if (typeof(xmlDocument.createNode) != "undefined") {
		// Older IE versions
		newElement = xmlDocument.createNode(1, prefix + objectType.localName, objectType.namespace);
	} else {
		throw new Exception("Unable to add child due to incompatible browser");
	}
	if (defaultValue)
		newElement.appendChild(xmlDocument.createTextNode(defaultValue));
	
	this.insertXMLNode(newElement, relativeTo, prepend);
	
	var childElement = new XMLElement(newElement, objectType, this.editor);
	this.addChildrenCount(childElement);
	if (this.domNode != null)
		childElement.render(this, true, relativeTo, prepend);
	childElement.populateChildren();
	
	return childElement;
};

XMLElement.prototype.insertXMLNode = function (newElement, relativeTo, prepend) {
	if (relativeTo) {
		if (relativeTo instanceof XMLElementStub) {
			// Stubs don't have an xml node, so need to position based off nearest real node
			var nextSiblings = this.domNode.nextAll(".xml_node:not(.xml_stub)");
			if (nextSiblings.length > 0) {
				$(newElement).insertBefore(nextSiblings.first().data("xmlObject").xmlNode);
			} else {
				this.xmlNode[0].appendChild(newElement);
			}
		} else {
			if (prepend)
				$(newElement).insertBefore(relativeTo.xmlNode);
			else
				$(newElement).insertAfter(relativeTo.xmlNode);
		}
	} else {
		if (prepend)
			this.xmlNode.prepend(newElement);
		else
			this.xmlNode[0].appendChild(newElement);
	}
};

// Add a new attribute of type objectType to this element
XMLElement.prototype.addAttribute = function (objectType) {
	// Verify that the attribute is not already present on the element
	if (this.attributeExists(objectType)) {
		return null;
	}

	var attributeValue = "";
	if (objectType.defaultValue) {
		attributeValue = objectType.defaultValue;
	} else if (objectType.values && objectType.values.length > 0) {
		// With enumerated attributes without a default, default to the first value
		attributeValue = objectType.values[0];
	}
	var node = this.xmlNode[0];
	var prefix;
	var attributeName = objectType.localName
	if (objectType.namespace != this.objectType.namespace) {
		prefix = this.editor.xmlState.getNamespacePrefix(objectType.namespace);
		attributeName = prefix + attributeName;
	}
	if (node.setAttributeNS && prefix) {
		node.setAttributeNS(objectType.namespace, attributeName, attributeValue);
	} else this.xmlNode.attr(attributeName, attributeValue);

	var attribute = new XMLAttribute(objectType, this, this.editor);
	attribute.render();

	return attribute;
};

XMLElement.prototype.attributeExists = function(attrDefinition) {
	var attr;
	if ($.type(attrDefinition) == "string") {
		attr = attrDefinition;
	} else {
		if (attrDefinition.namespace != this.objectType.namespace) {
			attr = this.editor.xmlState.getNamespacePrefix(attrDefinition.namespace) + attrDefinition.localName;
		} else {
			attr = attrDefinition.localName;
		}
	}
	
	attr = this.xmlNode.attr(attr);

	return typeof attr !== typeof undefined && attr !== false;
};


XMLElement.prototype.addNode = function (nodeType, prepend, relativeTo) {
	this.nodeContainer.show();
	if (this.attributeContainer) {
		this.attributeContainer.show();
	}
	switch (nodeType) {
		case "text" :
			if (this.allowText)
				return this.renderText(null, prepend, relativeTo);
			else return null;
		case "cdata" : return this.renderCData(null, prepend, relativeTo);
		case "comment" : return this.renderComment(null, prepend, relativeTo);
		case "element" :
			if (this.allowChildren) {
				return this.renderElementStub(prepend, relativeTo);
			}
			return null;
		case "attribute" :
			if (this.allowAttributes) {
				return this.renderAttributeStub();
			}
			return null;
	}
	return null;
};

// Remove an attribute of type objectType from this element
// "name" seems to come in with a namespace sometimes, localName does not.
XMLElement.prototype.removeAttribute = function (objectType) {
	var node = this.xmlNode[0];
	var localName = objectType.localName;
	var has_ns = node.hasAttributeNS(objectType.namespace, localName);

	if(has_ns) {
		var attr_name = objectType.name.split(':');
		node.removeAttributeNS(objectType.namespace, localName);
		node.removeAttribute("xmlns:" + attr_name[0]);
	} else {
		node.removeAttribute(localName);
	}
};

// Get the dom node for the currently selected attribute in this element
XMLElement.prototype.getSelectedAttribute = function () {
	return this.attributeContainer? this.attributeContainer.children(".selected") : [];
};

// Inform the element that its contents have been update, so that it can refresh itself
XMLElement.prototype.updated = function (event) {
	if (this.domNode == null)
		return;
	this.nodeCount = 0;
	this.attributeCount = 0;
	
	if (this.nodeContainer != null) {
		this.nodeCount = this.nodeContainer.children("." + xmlElementClass).length 
				+ this.nodeContainer.children("." + xmlTextClass).length;
		if (this.nodeCount > 0)
			this.nodeContainer.show();
		else this.nodeContainer.hide();
	}
	if (this.attributeContainer != null) {
		this.attributeCount = this.attributeContainer[0].children.length;
		if (this.attributeCount > 0)
			this.attributeContainer.show();
		else this.attributeContainer.hide();
	}
	
	// Show or hide the instructional placeholder depending on if there are any contents in the element
	if (this.nodeCount == 0 && this.attributeCount == 0) {
		this.placeholder.show();
	} else {
		this.placeholder.hide();
	}
	
	if (this.editor.options.elementUpdated)
		this.editor.options.elementUpdated.call(this, event);
};

XMLElement.prototype.getAttributeContainer = function() {
	return this.attributeContainer;
};

XMLElement.prototype.getChildContainer = function() {
	return this.childContainer;
};

XMLElement.prototype.toggleCollapsed = function() {
	var collapsed = this.domNode.hasClass("collapsed");
	var contentBlock = $(this.contentContainer);

	var $toggle = $(this.toggleCollapse);
	var self = this;

	if (collapsed) {
		$toggle.html("_");
		contentBlock.slideDown(150);
		self.domNode.removeClass("collapsed");
	} else {
		$toggle.html("+");
		
		contentBlock.slideUp(150, function() {
			self.domNode.addClass("collapsed");
		});
	}
};
function XMLElementStub(editor) {
	this.objectType = {
		elementStub : true
	};
	this.editor = editor;
	this.guiEditor = this.editor.guiEditor;
	// dom element header for this element
	this.elementHeader = null;
	// dom element which contains the display of child nodes
	this.nameInput = null;

	this.tagName = "";
}

XMLElementStub.prototype.render = function(parentElement, prepend, relativeToXMLElement) {
	this.parentElement = parentElement;
	this.domNodeID = this.guiEditor.nextIndex();
	
	// Create the element and add it to the container
	this.domNode = document.createElement('div');
	var $domNode = $(this.domNode);
	this.domNode.id = this.domNodeID;
	this.domNode.className = 'xml_node xml_stub ' + xmlElementClass;
	if (this.isTopLevel)
		this.domNode.className += ' ' + topLevelContainerClass;
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

	// set up element title and entry field if appropriate
	this.nameInput = $("<span contenteditable='true' class='edit_title'/>");
	this.nameInput.appendTo(elementNameContainer);

	var self = this;

	var createLink = $("<span class='create_element'>create element</span>").appendTo(elementNameContainer).mouseup(function(e){
		self.create();
	});


	this.elementHeader.appendChild(this.addTopActions(this.domNodeID));

	this.domNode = $domNode;
	this.domNode.data("xmlObject", this);

	stubNameInput.call(this, this.nameInput, parentElement.objectType.elements);
};

function stubNameInput(nameInput, suggestionList, validItemFunction) {
	var self = this;
	var autocompleteEnabled = false;
	
	nameInput.keydown(function(e) {
		// escape, cancel
		if (e.keyCode == 27) {
			if (autocompleteEnabled && $(nameInput.xml_autocomplete('widget')).is(':visible')) {
				nameInput.xml_autocomplete('close');
			} else {
				self.remove();
				self.guiEditor.selectNode(self.parentElement);
				var containingNode = self.parentElement? self.parentElement : self.xmlElement;
				containingNode.updated({action : 'childRemoved', target : self});
			}
			return false;
		}
		
		// Enter, create
		if (e.keyCode == 13) {
			self.create();
			return false;
		}

		// Prevent spaces
		if (e.keyCode == 32) {
			return false;
		}

		// Block propagation of text editing keys
		if (e.which >= 37 && e.which <= 40 || e.which == 46) {
			e.stopPropagation();
		}
	});

	var initializedAutocomplete = false;

	nameInput.focus(function(e) {
		// Activate autocompletion dropdown for possible child elements defined in schema
		if (!initializedAutocomplete && suggestionList && suggestionList.length > 0) {
			var suggDefs = [];
			var xmlState = self.editor.xmlState;

			for (var i in suggestionList) {
				var definition = suggestionList[i];
				suggDefs.push(xmlState.getNamespacePrefix(definition.namespace) + definition.localName);
			}

			nameInput.xml_autocomplete({
				source : suggDefs,
				minLength: 0,
				delay: 0,
				matchSize : nameInput,
				validItemFunction : validItemFunction,
				select : function(e, ui) {
					self.nameInput.text(ui.item.value);
					self.create();
				}
			});
			autocompleteEnabled = true;
			initializedAutocomplete = true;
		}

		if (autocompleteEnabled){
			nameInput.xml_autocomplete("search", nameInput.text());
		}
		e.stopPropagation();
	}).mousedown(function(e) {
		nameInput.focus();
		e.stopPropagation();
	});
}

XMLElementStub.prototype.addTopActions = function () {
	var self = this;
	var topActionSpan = document.createElement('li');
	topActionSpan.className = 'top_actions';
	
	var deleteButton = document.createElement('span');
	deleteButton.className = 'xml_delete';
	deleteButton.id = this.domNodeID + '_del';
	deleteButton.appendChild(document.createTextNode('X'));
	topActionSpan.appendChild(deleteButton);
	
	return topActionSpan;
};

XMLElementStub.prototype.remove = function() {
	this.domNode.remove();
};

XMLElementStub.prototype.create = function() {
	var tagName = this.nameInput.text();

	var nextSiblings = this.domNode.nextAll(".xml_node:not(.xml_stub)");
	var relativeTo = null;
	if (nextSiblings.length > 0) {
		relativeTo = nextSiblings.first().data("xmlObject");
	}

	var newElement = this.editor.addChildElement(this.parentElement, tagName, relativeTo, relativeTo != null);
	if (newElement instanceof AbstractXMLObject) {
		// Move new element to match display position of the stub, in case it was misplaced because of its siblings being stubs
		newElement.domNode.detach();
		this.domNode.after(newElement.domNode);
		this.remove();
		this.guiEditor.focusSelectedText(newElement);
	} else {
		console.log(newElement);
	}
};

XMLElementStub.prototype.getSelectedAttribute = function () {
	return [];
};

XMLElementStub.prototype.select = function() {
	this.domNode.addClass("selected");
};

XMLElementStub.prototype.isSelected = function() {
	return this.domNode.hasClass("selected");
};

XMLElementStub.prototype.focus = function() {
	this.nameInput.focus();
};
/**
 * Create class to select and load default XML templates
 * @param init_object
 * @constructor
 */

function XMLTemplates(init_object) {
    this.template_path = init_object.options.templatePath;
    this.templates = init_object.options.templates;
    this.editor = init_object;
}

XMLTemplates.prototype.constructor = XMLTemplates;

/**
 * Load the dialog form for user to select a template from a list of provided templates
 */
XMLTemplates.prototype.createDialog = function() {
    var self = this,
        dialog, form;

    dialog = $("#dialog-form").dialog({
        autoOpen: true,
        dialogClass: "no-close",
        height: 350,
        width: 500,
        modal: true,
        buttons: {
            "Select Template": function() { self.processForm($(this), self); },
            Cancel: function() {
                $(this).dialog("close");

                var default_template = self.editor.options.cancelTemplate;

                if(default_template) {
                    self.loadSelectedTemplate(default_template, self);
                } else {
                   self.editor.loadSchema(self.editor.options.schema);
                }
            }
        },
        close: function() {
            form[0].reset();
            $([]).add(self.selected).removeClass("ui-state-error");
        }
    });

    form = dialog.find("form").on("submit", function(e) {
        e.preventDefault();
    });
};

/**
 * Create form & add to DOM
 * Don't think we can assume user will build this form themselves
 */
XMLTemplates.prototype.templateForm = function() {
    var form = '<div id="dialog-form" title="Please Select a Template">' +
      '<p class="validateTips">Form field is required.</p>' +
      '<form>' +
        '<fieldset>';
    for(var i=0; i<this.templates.length; i++) {
        form += '<input class="templating" name="templating" type="radio" value="' + this.templates[i] + '">' + this.templates[i] + '<br />';
    }

    form += '<input type="submit" tabindex="-1" style="position:absolute; top:-1000px">' +
       '</fieldset>' +
      '</form>' +
    '</div>';

    $(form).insertAfter("body");
};

/**
 * Select a template from the form
 * @param dialog
 * @param self
 * @returns {boolean}
 */
XMLTemplates.prototype.processForm = function(dialog, self) {
    var valid = true;
    var selected = $(".validateTips");
    var selection = $("input[name=templating]:checked").val();

    selected.removeClass("ui-state-error");

    if (selection === undefined) {
        valid = false;
        selected.addClass("ui-state-error").css("display", "block");
    } else {
        $(dialog).dialog("close");
        self.loadSelectedTemplate(selection, self);
    }

    return valid;
};

/**
 * Load selected template.
 * @param selection
 * @param self
 */
XMLTemplates.prototype.loadSelectedTemplate = function(selection, self) {
    // Default template loading doesn't have access to xml_templates constructor
    if(self.editor === undefined) { self.editor = self; }

    $.ajax({
        url: this.template_path + selection,
        dataType: "xml"
    }).done(function(data) {
        var xml_string = self.editor.xml2Str(data);
        self.editor._documentReady(xml_string);
        self.editor.loadSchema(self.editor.options.schema);
    }).fail(function(jqXHR, textStatus) {
        self.editor.loadSchema(self.editor.options.schema);
        alert("Unable to load the requested template: " + textStatus);
    });
};
function XMLTextNode(textNode, dataType, editor) {
	var textType = {
		text : true,
		type : dataType
	};

	this.textNode = textNode;
	this.xmlNode = $(textNode);
	
	AbstractXMLObject.call(this, textType, editor);
	
}

XMLTextNode.prototype.constructor = XMLTextNode;
XMLTextNode.prototype = Object.create( AbstractXMLObject.prototype );

// Persist the input value back into the text node
XMLTextNode.prototype.syncText = function() {
	this.textNode.nodeValue = this.textInput.val();
};

XMLTextNode.prototype.select = function() {
	$(".selected").removeClass("selected");
	this.domNode.closest("." + xmlElementClass).addClass("selected");
	this.domNode.addClass("selected");

};

XMLTextNode.prototype.addXmlNode = function(prepend) {
	var textValue = "";
	if (!this.textNode) {
		this.textNode = document.createTextNode("");
		if (prepend) {
			this.parentElement.xmlNode.prepend(this.textNode);
		} else {
			this.parentElement.xmlNode[0].appendChild(this.textNode);
		}
		this.xmlNode = $(this.textNode);
	} else {
		textValue = this.textNode.nodeValue;
	}
	return textValue;
};

XMLTextNode.prototype.render = function(parentElement, prepend) {
	this.parentElement = parentElement;
	this.domNodeID = this.guiEditor.nextIndex();
	
	// Create the element and add it to the container
	this.domNode = document.createElement('div');
	var $domNode = $(this.domNode);
	this.domNode.id = this.domNodeID;
	this.domNode.className = xmlNodeClass + ' ' + xmlTextClass;
	
	if (prepend) {
		this.parentElement.nodeContainer.prepend(this.domNode);
	} else {
		this.parentElement.nodeContainer[0].appendChild(this.domNode);
	}

	var inputColumn = document.createElement('div');
	inputColumn.className = 'xml_input_column';
	this.domNode.appendChild(inputColumn);

	var textValue = this.addXmlNode(prepend);

	this.textInput = AbstractXMLObject.prototype.createElementInput.call(this,
			this.domNodeID + "_text", textValue, inputColumn);
	this.textInput.addClass('element_text');

	this.deleteButton = document.createElement('div');
	this.deleteButton.className = 'xml_delete';
	this.deleteButton.appendChild(document.createTextNode('x'));
	this.domNode.appendChild(this.deleteButton);

	this.domNode = $domNode;
	this.domNode.data("xmlObject", this);
	
	return this.domNode;
};

XMLTextNode.prototype.swap = function(swapTarget) {
	AbstractXMLObject.prototype.swap.call(this, swapTarget);
};

XMLTextNode.prototype.moveUp = function() {
	AbstractXMLObject.prototype.moveUp.call(this);
};

XMLTextNode.prototype.moveDown = function() {
	AbstractXMLObject.prototype.moveDown.call(this);
};

XMLTextNode.prototype.focus = function() {
	AbstractXMLObject.prototype.focus.call(this);
};

XMLTextNode.prototype.isSelected = function() {
	return AbstractXMLObject.prototype.isSelected.call(this);
};
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

XMLUnspecifiedElement.prototype.render = function(parentElement, recursive, relativeTo, prepend) {
	this.parentElement = parentElement;
	this.domNodeID = this.guiEditor.nextIndex();
	
	// Create the element and add it to the container
	this.domElement = document.createElement('div');
	this.domNode = $(this.domElement);

	this.domElement.id = this.domNodeID;
	this.domElement.className = 'xml_node ' + xmlElementClass;
	if (this.isTopLevel)
		this.domElement.className += ' ' + topLevelContainerClass;
	if (this.isRootElement)
		this.domElement.className += ' xml_root_element';

	this.insertDOMNode(relativeTo, prepend);
	
	// Begin building contents
	this.elementHeader = document.createElement('ul');
	this.elementHeader.className = 'element_header';
	this.domElement.appendChild(this.elementHeader);
	var elementNameContainer = document.createElement('li');
	elementNameContainer.className = 'element_name';
	this.elementHeader.appendChild(elementNameContainer);

	this.elementName = this.xmlNode[0].tagName;
	
	// set up element title and entry field if appropriate
	var titleElement = document.createElement('span');
	titleElement.appendChild(document.createTextNode(this.elementName));
	elementNameContainer.appendChild(titleElement);
	
	// Switch gui element over to a jquery object
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

	this.contentContainer = document.createElement("div");
	this.domElement.appendChild(this.contentContainer);
	
	var placeholder = document.createElement('div');
	placeholder.className = 'placeholder';

	placeholder.appendChild(document.createTextNode('Use the menu to add contents.'));

	this.contentContainer.appendChild(placeholder);
	this.placeholder = $(placeholder);
	
	this.addAttributeContainer();

	this.addNodeContainer(recursive);
};

XMLUnspecifiedElement.prototype.updateChildrenCount = function(childElement, delta) {
	this.nodeCount += delta;
};

XMLUnspecifiedElement.prototype.childCanBeRemoved = function(childType) {
	return true;
};
})(jQuery);