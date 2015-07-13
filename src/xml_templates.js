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
            Choose : function() {
                self.processForm($(this), self);
            },
            Cancel : function() {
                $(this).dialog("close");

                var default_template = self.editor.options.cancelTemplate;

                if(default_template) {
                    self.loadSelectedTemplate(default_template, self);
                } else {
                   self.editor.loadSchema(self.editor.options.schema);
                }
            }
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
    var form = '<div id="dialog-form" title="Choose Template">' +
        '<ul>';

    for(var i=0; i<this.templates.length; i++) {
        form += '<li class="templating"'  + ' id="template_' + i + '">' +
            '<a href="#">' +
            '   <i class="fa fa-file-o"></i> ' + this._formatFormText(this.templates[i]) +
            '</a>'
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
 * @returns {boolean}
 */
XMLTemplates.prototype.processForm = function(dialog, self) {
    var selection = $(".focus").text();

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
    if(self.editor === undefined) { self.editor = self; }

    $.ajax({
        url: this.template_path + this._formatFormSubmitText(selection),
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
 */
XMLTemplates.prototype.focusTemplate = function() {
    $('#dialog-form ul').on('click keydown', function(e) {
        e.preventDefault();
        var key = e.which;
        var number_of_forms, base_element, current, form_id, next_element;

        if(key === 1 || key === 9) {
            number_of_forms = $('#dialog-form ul li').length;

            if(key == 1) {
                base_element = $('#' + e.target.id);
            } else if(key === 9) {
                current = $('.focus').attr('id');
                form_id = parseInt(current.slice(-1)) + 1;
                next_element = (form_id === number_of_forms) ? 0 : form_id;
                base_element = $('#template_' + next_element);
            }

            $('.templating').removeClass('focus');
            base_element.addClass('focus').focus();
        }
    });

    $(document)
};


XMLTemplates.prototype.loadFromDirectClick = function(e) {
    $('#dialog-form').on('dblclick', function(e) {

        this.processForm();
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
    var remove_file_format = string.replace(/\.\w{3,4}$/, '');
    return remove_file_format.charAt(0).toUpperCase() + remove_file_format.slice(1);
};

/**
 * Undo pretty printing to get actual file name to load
 * @param string
 * @returns {string}
 * @private
 */
XMLTemplates.prototype._formatFormSubmitText = function(string) {
    return $.trim(string.toLowerCase()) + '.xml';
};