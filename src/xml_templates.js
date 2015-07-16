/**
 * Create class to focus, select and load default XML templates
 * @param init_object
 * @constructor
 */
function XMLTemplates(init_object) {
    this.template_path = init_object.options.templateOptions.templatePath;
    this.templates = init_object.options.templateOptions.templates;
    this.editor = init_object;
    this.extension_regx = /\.\w{3,}$/;
}

XMLTemplates.prototype.constructor = XMLTemplates;

/**
 * Load the dialog form for user to select a template from a list of provided templates
 * @returns {*|jQuery}
 */
XMLTemplates.prototype.createDialog = function() {
    var self = this,
        dialog, form;

    dialog = $("#dialog-form").dialog({
        autoOpen: true,
        dialogClass: "jquery-editor-no-close template-form",
        height: 350,
        width: 500,
        modal: true,
        buttons: {
            Choose : function() {
                self.processForm($(this), self);
            },
            Cancel : function() {
                $(this).dialog("close");

                var default_template = self.editor.options.templateOptions.cancelTemplate;

                if (default_template) {
                    self.loadSelectedTemplate(default_template, self);
                } else {
                   history.go(-1);
                   self.editor.loadSchema(self.editor.options.schema);
                }
            }
        }
    });

    form = dialog.find("form").on("submit", function(e) {
        e.preventDefault();
    });

    return dialog;
};

/**
 * Create form & add to DOM
 * Don't think we can assume user will build this form themselves
 */
XMLTemplates.prototype.templateForm = function() {
    var form = '<div id="dialog-form" class="template-form" title="Choose Template">' +
        '<ul>';

    for(var i=0; i<this.templates.length; i++) {
        var current = this.templates[i];

        form += '<li class="templating"'  + ' id="template_' + i + '">' +
            '<a href="' + current.filename + '">';

        if (current.icon_url) {
           form += '<img class="' + current.icon_class + '" src="' + current.icon_url + '"/> ';
        }

        if (current.icon_class) {
           form += '<i class="' + current.icon_class + '"></i> ';
        }
        form += '<div>';
        form += this._formatFormText(current.filename);

        if (current.description) {
            form += '<span>' + current.description + '</span>';
        }

        form += '</div>';

        form += '</a>' +
            '</li>';
    }

    form += '</ul>' +
        '</div>';

    $(form).insertAfter("body");
    $('#dialog-form li:first').addClass('focus');
};

/**
 * Select a template from the form
 * @param dialog
 * @param self
 */
XMLTemplates.prototype.processForm = function(dialog, self) {
    // Split on mdash if description present
    var selection = $(".focus a").attr('href');

    $(dialog).dialog("close");
    self.loadSelectedTemplate(selection, self);
};

/**
 * Load selected template.
 * @param selection
 * @param self
 */
XMLTemplates.prototype.loadSelectedTemplate = function(selection, self) {
    // Default template loading doesn't have access to xml_templates constructor
    if (self.editor === undefined) { self.editor = self; }

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

/**
 * Highlight and focus currently selected template
 * If enter hit go ahead and load focused template
 * @param dialog
 */
XMLTemplates.prototype.focusTemplate = function(dialog) {
    var self = this;

    // Focus selected template
    $('.jquery-editor-no-close').on('click keydown', function(e) {
        e.preventDefault();
        var key = e.which;
        var number_of_forms, base_element, current, form_id, next_element;

        if (key === 1 || key === 9) {
            number_of_forms = $('#dialog-form ul li').length;
            if (key == 1) {
                base_element = $('#' + e.target.id);
            } else {
                current = $('.focus').attr('id');
                form_id = parseInt(current.slice(-1)) + 1;
                next_element = (form_id === number_of_forms) ? 0 : form_id;
                base_element = $('#template_' + next_element);
            }

            $('.templating').removeClass('focus');
            base_element.addClass('focus').focus();
        }

        // Go ahead and load it if enter/escape hit
        if (key == 13 || key == 27) {
            self.processForm(dialog, self);
        }
    });
};

/**
 * Load a template by double clicking it.
 * @param dialog
 */
XMLTemplates.prototype.loadEvents = function(dialog) {
    var self = this;

    $('#dialog-form').on('dblclick', function() {
        self.processForm(dialog, self);
    });
};

/**
 * Format template names for dialog form
 * Remove file extension
 * Upper case first letter for template names without extending String prototype
 * @param string
 * @returns {string}
 * @private
 */
XMLTemplates.prototype._formatFormText = function(string) {
    var remove_file_format = string.replace(this.extension_regx, '');
    return remove_file_format.charAt(0).toUpperCase() + remove_file_format.slice(1);
};