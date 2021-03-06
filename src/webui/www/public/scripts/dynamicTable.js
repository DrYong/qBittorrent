/*
 * MIT License
 * Copyright (c) 2008 Ishan Arora <ishan@qbittorrent.org> & Christophe Dumez <chris@qbittorrent.org>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

/**************************************************************

    Script      : Dynamic Table
    Version     : 0.5
    Authors     : Ishan Arora & Christophe Dumez
    Desc        : Programable sortable table
    Licence     : Open Source MIT Licence

 **************************************************************/

var DynamicTableHeaderContextMenuClass = null;
var ProgressColumnWidth = -1;

var DynamicTable = new Class({

        initialize : function () {},

        setup : function (dynamicTableDivId, dynamicTableFixedHeaderDivId, contextMenu) {
            this.dynamicTableDivId = dynamicTableDivId;
            this.dynamicTableFixedHeaderDivId = dynamicTableFixedHeaderDivId;
            this.fixedTableHeader = $(dynamicTableFixedHeaderDivId).getElements('tr')[0];
            this.hiddenTableHeader = $(dynamicTableDivId).getElements('tr')[0];
            this.tableBody = $(dynamicTableDivId).getElements('tbody')[0];
            this.rows = new Hash();
            this.selectedRows = [];
            this.columns = [];
            this.contextMenu = contextMenu;
            this.sortedColumn = getLocalStorageItem('sorted_column_' + this.dynamicTableDivId, 0);
            this.reverseSort = getLocalStorageItem('reverse_sort_' + this.dynamicTableDivId, '0');
            this.initColumns();
            this.loadColumnsOrder();
            this.updateTableHeaders();
            this.setupCommonEvents();
            this.setupHeaderEvents();
            this.setupHeaderMenu();
        },

        setupCommonEvents : function () {
            var scrollFn = function() {
                $(this.dynamicTableFixedHeaderDivId).getElements('table')[0].style.left =
                       -$(this.dynamicTableDivId).scrollLeft + 'px';
            }.bind(this);

            $(this.dynamicTableDivId).addEvent('scroll', scrollFn);

            var resizeFn = function() {
                var panel = $(this.dynamicTableDivId).getParent('.panel');
                var h = panel.getBoundingClientRect().height - $(this.dynamicTableFixedHeaderDivId).getBoundingClientRect().height;
                $(this.dynamicTableDivId).style.height = h + 'px';

                // Workaround due to inaccurate calculation of elements heights by browser

                var n = 2;

                while (panel.clientWidth != panel.offsetWidth && n > 0) { // is panel vertical scrollbar visible ?
                    n--;
                    h -= 0.5;
                    $(this.dynamicTableDivId).style.height = h + 'px';
                }

                this.lastPanelHeight = panel.getBoundingClientRect().height;
            }.bind(this);

            $(this.dynamicTableDivId).getParent('.panel').addEvent('resize', resizeFn);

            this.lastPanelHeight = 0;

            // Workaround. Resize event is called not always (for example it isn't called when browser window changes it's size)

            var checkResizeFn = function() {
                var panel = $(this.dynamicTableDivId).getParent('.panel');
                if (this.lastPanelHeight != panel.getBoundingClientRect().height) {
                    this.lastPanelHeight = panel.getBoundingClientRect().height;
                    panel.fireEvent('resize');
                }
            }.bind(this);

            setInterval(checkResizeFn, 500);
        },

        setupHeaderEvents : function () {
            this.currentHeaderAction = '';
            this.canResize = false;

            var resetElementBorderStyle = function (el, side) {
                if (side === 'left' || side !== 'right') {
                    el.setStyle('border-left-style', '');
                    el.setStyle('border-left-color', '');
                    el.setStyle('border-left-width', '');
                }
                if (side === 'right' || side !== 'left') {
                    el.setStyle('border-right-style', '');
                    el.setStyle('border-right-color', '');
                    el.setStyle('border-right-width', '');
                }
            };

            var mouseMoveFn = function (e) {
                var brect = e.target.getBoundingClientRect();
                var mouseXRelative = e.event.clientX - brect.left;
                if (this.currentHeaderAction === '') {
                    if (brect.width - mouseXRelative < 5) {
                        this.resizeTh = e.target;
                        this.canResize = true;
                        e.target.getParent("tr").style.cursor = 'col-resize';
                    }
                    else if ((mouseXRelative < 5) && e.target.getPrevious('[class=""]')) {
                        this.resizeTh = e.target.getPrevious('[class=""]');
                        this.canResize = true;
                        e.target.getParent("tr").style.cursor = 'col-resize';
                    } else {
                        this.canResize = false;
                        e.target.getParent("tr").style.cursor = '';
                    }
                }
                if (this.currentHeaderAction === 'drag') {
                    var previousVisibleSibling = e.target.getPrevious('[class=""]');
                    var borderChangeElement = previousVisibleSibling;
                    var changeBorderSide = 'right';

                    if (mouseXRelative > brect.width / 2) {
                        borderChangeElement = e.target;
                        this.dropSide = 'right';
                    }
                    else {
                        this.dropSide = 'left';
                    }

                    e.target.getParent("tr").style.cursor = 'move';

                    if (!previousVisibleSibling) { // right most column
                        borderChangeElement = e.target;

                        if (mouseXRelative <= brect.width / 2)
                            changeBorderSide = 'left';
                    }

                    borderChangeElement.setStyle('border-' + changeBorderSide + '-style', 'solid');
                    borderChangeElement.setStyle('border-' + changeBorderSide + '-color', '#e60');
                    borderChangeElement.setStyle('border-' + changeBorderSide + '-width', 'initial');

                    resetElementBorderStyle(borderChangeElement, changeBorderSide === 'right' ? 'left' : 'right');

                    borderChangeElement.getSiblings('[class=""]').each(function(el){
                        resetElementBorderStyle(el);
                    });
                }
                this.lastHoverTh = e.target;
                this.lastClientX = e.event.clientX;
            }.bind(this);

            var mouseOutFn = function (e) {
                resetElementBorderStyle(e.target);
            }.bind(this);

            var onBeforeStart = function (el) {
                this.clickedTh = el;
                this.currentHeaderAction = 'start';
                this.dragMovement = false;
                this.dragStartX = this.lastClientX;
            }.bind(this);

            var onStart = function (el, event) {
                if (this.canResize) {
                    this.currentHeaderAction = 'resize';
                    this.startWidth = this.resizeTh.getStyle('width').toFloat();
                }
                else {
                    this.currentHeaderAction = 'drag';
                    el.setStyle('background-color', '#C1D5E7');
                }
            }.bind(this);

            var onDrag = function (el, event) {
                if (this.currentHeaderAction === 'resize') {
                    var width = this.startWidth + (event.page.x - this.dragStartX);
                    if (width < 16)
                        width = 16;
                    this.columns[this.resizeTh.columnName].width = width;
                    this.updateColumn(this.resizeTh.columnName);
                }
            }.bind(this);

            var onComplete = function (el, event) {
                resetElementBorderStyle(this.lastHoverTh);
                el.setStyle('background-color', '');
                if (this.currentHeaderAction === 'resize')
                    localStorage.setItem('column_' + this.resizeTh.columnName + '_width_' + this.dynamicTableDivId, this.columns[this.resizeTh.columnName].width);
                if ((this.currentHeaderAction === 'drag') && (el !== this.lastHoverTh)) {
                    this.saveColumnsOrder();
                    var val = localStorage.getItem('columns_order_' + this.dynamicTableDivId).split(',');
                    val.erase(el.columnName);
                    var pos = val.indexOf(this.lastHoverTh.columnName);
                    if (this.dropSide === 'right') pos++;
                    val.splice(pos, 0, el.columnName);
                    localStorage.setItem('columns_order_' + this.dynamicTableDivId, val.join(','));
                    this.loadColumnsOrder();
                    this.updateTableHeaders();
                    while (this.tableBody.firstChild)
                        this.tableBody.removeChild(this.tableBody.firstChild);
                    this.updateTable(true);
                }
                if (this.currentHeaderAction === 'drag') {
                    resetElementBorderStyle(el);
                    el.getSiblings('[class=""]').each(function(el){
                        resetElementBorderStyle(el);
                    });
                }
                this.currentHeaderAction = '';
            }.bind(this);

            var onCancel = function (el) {
                this.currentHeaderAction = '';
                this.setSortedColumn(el.columnName);
            }.bind(this);

            var ths = this.fixedTableHeader.getElements('th');

            for (var i = 0; i < ths.length; i++) {
                var th = ths[i];
                th.addEvent('mousemove', mouseMoveFn);
                th.addEvent('mouseout', mouseOutFn);
                th.makeResizable({
                    modifiers : {x: '', y: ''},
                    onBeforeStart : onBeforeStart,
                    onStart : onStart,
                    onDrag : onDrag,
                    onComplete : onComplete,
                    onCancel : onCancel
                });
            }
        },

        setupDynamicTableHeaderContextMenuClass : function () {
            if (!DynamicTableHeaderContextMenuClass) {
                DynamicTableHeaderContextMenuClass = new Class({
                    Extends: ContextMenu,
                    updateMenuItems: function () {
                        for (var i = 0; i < this.dynamicTable.columns.length; i++) {
                            if (this.dynamicTable.columns[i].caption === '')
                                continue;
                            if (this.dynamicTable.columns[i].visible !== '0')
                                this.setItemChecked(this.dynamicTable.columns[i].name, true);
                            else
                                this.setItemChecked(this.dynamicTable.columns[i].name, false);
                        }
                    }
                });
            }
        },

        showColumn : function (columnName, show) {
            this.columns[columnName].visible = show ? '1' : '0';
            localStorage.setItem('column_' + columnName + '_visible_' + this.dynamicTableDivId, show ? '1' : '0');
            this.updateColumn(columnName);
        },

        setupHeaderMenu : function () {
            this.setupDynamicTableHeaderContextMenuClass();

            var menuId = this.dynamicTableDivId + '_headerMenu';

            var ul = new Element('ul', {id: menuId, class: 'contextMenu scrollableMenu'});

            var createLi = function(columnName, text) {
                    var html = '<a href="#' + columnName + '" ><img src="theme/checked"/>' + escapeHtml(text) + '</a>';
                    return new Element('li', {html: html});
                };

            var actions = {};

            var onMenuItemClicked = function (element, ref, action) {
                    this.showColumn(action, this.columns[action].visible === '0');
                }.bind(this);

            for (var i = 0; i < this.columns.length; i++) {
                var text = this.columns[i].caption;
                if (text === '')
                    continue;
                ul.appendChild(createLi(this.columns[i].name, text));
                actions[this.columns[i].name] = onMenuItemClicked;
            }

            ul.inject(document.body);

            this.headerContextMenu = new DynamicTableHeaderContextMenuClass({
                targets: '#' + this.dynamicTableFixedHeaderDivId + ' tr',
                actions: actions,
                menu : menuId,
                offsets : {
                    x : -15,
                    y : 2
                }
            });

            this.headerContextMenu.dynamicTable = this;
        },

        initColumns : function () {},

        newColumn : function (name, style, caption, defaultWidth, defaultVisible) {
            var column = {};
            column['name'] = name;
            column['visible'] = getLocalStorageItem('column_' + name + '_visible_' + this.dynamicTableDivId, defaultVisible ? '1' : '0');
            column['force_hide'] = false;
            column['caption'] = caption;
            column['style'] = style;
            column['width'] = getLocalStorageItem('column_' + name + '_width_' + this.dynamicTableDivId, defaultWidth);
            column['dataProperties'] = [name];
            column['getRowValue'] = function (row, pos) {
                if (pos === undefined)
                    pos = 0;
                return row['full_data'][this.dataProperties[pos]];
            };
            column['compareRows'] = function (row1, row2) {
                if (this.getRowValue(row1) < this.getRowValue(row2))
                    return -1;
                else if (this.getRowValue(row1) > this.getRowValue(row2))
                    return 1;
                else return 0;
            };
            column['updateTd'] = function (td, row) {
                td.innerHTML = this.getRowValue(row);
            };
            column['onResize'] = null;
            this.columns.push(column);
            this.columns[name] = column;

            this.hiddenTableHeader.appendChild(new Element('th'));
            this.fixedTableHeader.appendChild(new Element('th'));
        },

        loadColumnsOrder : function () {
            var columnsOrder = [];
            var val = localStorage.getItem('columns_order_' + this.dynamicTableDivId);
            if (val === null || val === undefined) return;
            val.split(',').forEach(function(v) {
                if ((v in this.columns) && (!columnsOrder.contains(v)))
                    columnsOrder.push(v);
            }.bind(this));

            for (i = 0; i < this.columns.length; i++)
                if (!columnsOrder.contains(this.columns[i].name))
                    columnsOrder.push(this.columns[i].name);

            for (i = 0; i < this.columns.length; i++)
                this.columns[i] = this.columns[columnsOrder[i]];
        },

        saveColumnsOrder : function () {
            val = '';
            for (i = 0; i < this.columns.length; i++) {
                if (i > 0)
                    val += ',';
                val += this.columns[i].name;
            }
            localStorage.setItem('columns_order_' + this.dynamicTableDivId, val);
        },

        updateTableHeaders : function () {
            this.updateHeader(this.hiddenTableHeader);
            this.updateHeader(this.fixedTableHeader);
        },

        updateHeader : function (header) {
            var ths = header.getElements('th');

            for (var i = 0; i < ths.length; i++) {
                th = ths[i];
                th._this = this;
                th.setAttribute('title', this.columns[i].caption);
                th.innerHTML = this.columns[i].caption;
                th.setAttribute('style', 'width: ' + this.columns[i].width + 'px;' + this.columns[i].style);
                th.columnName = this.columns[i].name;
                if ((this.columns[i].visible == '0') || this.columns[i].force_hide)
                    th.addClass('invisible');
                else
                    th.removeClass('invisible');
            }
        },

        getColumnPos : function (columnName) {
            for (var i = 0; i < this.columns.length; i++)
                if (this.columns[i].name == columnName)
                    return i;
            return -1;
        },

        updateColumn : function (columnName) {
            var pos = this.getColumnPos(columnName);
            var visible = ((this.columns[pos].visible != '0') && !this.columns[pos].force_hide);
            var ths = this.hiddenTableHeader.getElements('th');
            var fths = this.fixedTableHeader.getElements('th');
            var trs = this.tableBody.getElements('tr');
            var style = 'width: ' + this.columns[pos].width + 'px;' + this.columns[pos].style;

            ths[pos].setAttribute('style', style);
            fths[pos].setAttribute('style', style);

            if (visible) {
                ths[pos].removeClass('invisible');
                fths[pos].removeClass('invisible');
                for (var i = 0; i < trs.length; i++)
                    trs[i].getElements('td')[pos].removeClass('invisible');
            }
            else {
                ths[pos].addClass('invisible');
                fths[pos].addClass('invisible');
                for (var j = 0; j < trs.length; j++)
                    trs[j].getElements('td')[pos].addClass('invisible');
            }
            if (this.columns[pos].onResize !== null)
            {
                this.columns[pos].onResize(columnName);
            }
        },

        setSortedColumn : function (column) {
            if (column != this.sortedColumn) {
                this.sortedColumn = column;
                this.reverseSort = '0';
            }
            else {
                // Toggle sort order
                this.reverseSort = this.reverseSort == '0' ? '1' : '0';
            }
            localStorage.setItem('sorted_column_' + this.dynamicTableDivId, column);
            localStorage.setItem('reverse_sort_' + this.dynamicTableDivId, this.reverseSort);
            this.updateTable(false);
        },

        getSelectedRowId : function () {
            if (this.selectedRows.length > 0)
                return this.selectedRows[0];
            return '';
        },

        altRow : function () {
            if (!MUI.ieLegacySupport)
                return;

            var trs = this.tableBody.getElements('tr');
            trs.each(function (el, i) {
                if (i % 2) {
                    el.addClass('alt');
                } else {
                    el.removeClass('alt');
                }
            }.bind(this));
        },

        selectAll : function () {
            this.selectedRows.empty();

            var trs = this.tableBody.getElements('tr');
            for (var i = 0; i < trs.length; i++) {
                var tr = trs[i];
                this.selectedRows.push(tr.rowId);
                if (!tr.hasClass('selected'))
                    tr.addClass('selected');
            }
        },

        deselectAll : function () {
            this.selectedRows.empty();
        },

        selectRow : function (rowId) {
            this.selectedRows.empty();
            this.selectedRows.push(rowId);
            var trs = this.tableBody.getElements('tr');
            for (var i = 0; i < trs.length; i++) {
                var tr = trs[i];
                if (tr.rowId == rowId) {
                    if (!tr.hasClass('selected'))
                        tr.addClass('selected');
                }
                else
                if (tr.hasClass('selected'))
                    tr.removeClass('selected');
            }
            this.onSelectedRowChanged();
        },

        onSelectedRowChanged : function () {},

        updateRowData : function (data) {
            var rowId = data['rowId'];
            var row;

            if (!this.rows.has(rowId)) {
                row = {};
                this.rows.set(rowId, row);
                row['full_data'] = {};
                row['rowId'] = rowId;
            }
            else
                row = this.rows.get(rowId);

            row['data'] = data;

            for(var x in data)
                row['full_data'][x] = data[x];
        },

        getFilteredAndSortedRows : function () {
            var filteredRows = [];

            var rows = this.rows.getValues();

            for (i = 0; i < rows.length; i++)
            {
                filteredRows.push(rows[i]);
                filteredRows[rows[i].rowId] = rows[i];
            }

            filteredRows.sort(function (row1, row2) {
                var column = this.columns[this.sortedColumn];
                res = column.compareRows(row1, row2);
                if (this.reverseSort == '0')
                    return res;
                else
                    return -res;
            }.bind(this));
            return filteredRows;
        },

        getTrByRowId : function (rowId) {
            trs = this.tableBody.getElements('tr');
            for (var i = 0; i < trs.length; i++)
                if (trs[i].rowId == rowId)
                    return trs[i];
            return null;
        },

        updateTable : function (fullUpdate) {
            if (fullUpdate === undefined)
                fullUpdate = false;

            var rows = this.getFilteredAndSortedRows();

            for (var i = 0; i < this.selectedRows.length; i++)
                if (!(this.selectedRows[i] in rows)) {
                    this.selectedRows.splice(i, 1);
                    i--;
                }

            var trs = this.tableBody.getElements('tr');

            for (var rowPos = 0; rowPos < rows.length; rowPos++) {
                var rowId = rows[rowPos]['rowId'];
                tr_found = false;
                for (var j = rowPos; j < trs.length; j++)
                    if (trs[j]['rowId'] == rowId) {
                        tr_found = true;
                        if (rowPos == j)
                            break;
                        trs[j].inject(trs[rowPos], 'before');
                        var tmpTr = trs[j];
                        trs.splice(j, 1);
                        trs.splice(rowPos, 0, tmpTr);
                        break;
                    }
                if (tr_found) // row already exists in the table
                    this.updateRow(trs[rowPos], fullUpdate);
                else { // else create a new row in the table
                    var tr = new Element('tr');

                    tr['rowId'] = rows[rowPos]['rowId'];

                    tr._this = this;
                    tr.addEvent('contextmenu', function (e) {
                        if (!this._this.selectedRows.contains(this.rowId))
                            this._this.selectRow(this.rowId);
                        return true;
                    });
                    tr.addEvent('click', function (e) {
                        e.stop();
                        if (e.control) {
                            // CTRL key was pressed
                            if (this._this.selectedRows.contains(this.rowId)) {
                                // remove it
                                this._this.selectedRows.erase(this.rowId);
                                // Remove selected style
                                this.removeClass('selected');
                            }
                            else {
                                this._this.selectedRows.push(this.rowId);
                                // Add selected style
                                this.addClass('selected');
                            }
                        }
                        else {
                            if (e.shift && this._this.selectedRows.length == 1) {
                                // Shift key was pressed
                                var first_row_id = this._this.selectedRows[0];
                                var last_row_id = this.rowId;
                                this._this.selectedRows.empty();
                                var trs = this._this.tableBody.getElements('tr');
                                var select = false;
                                for (var i = 0; i < trs.length; i++) {
                                    var tr = trs[i];

                                    if ((tr.rowId == first_row_id) || (tr.rowId == last_row_id)) {
                                        this._this.selectedRows.push(tr.rowId);
                                        tr.addClass('selected');
                                        select = !select;
                                    }
                                    else {
                                        if (select) {
                                            this._this.selectedRows.push(tr.rowId);
                                            tr.addClass('selected');
                                        }
                                        else
                                            tr.removeClass('selected');
                                    }
                                }
                            } else {
                                // Simple selection
                                this._this.selectRow(this.rowId);
                            }
                        }
                        return false;
                    });

                    this.setupTr(tr);

                    for (var k = 0 ; k < this.columns.length; k++) {
                        var td = new Element('td');
                        if ((this.columns[k].visible == '0') || this.columns[k].force_hide)
                            td.addClass('invisible');
                        td.injectInside(tr);
                    }

                    // Insert
                    if (rowPos >= trs.length) {
                        tr.inject(this.tableBody);
                        trs.push(tr);
                    }
                    else {
                        tr.inject(trs[rowPos], 'before');
                        trs.splice(rowPos, 0, tr);
                    }

                    // Update context menu
                    if (this.contextMenu)
                        this.contextMenu.addTarget(tr);

                    this.updateRow(tr, true);
                }
            }

            rowPos = rows.length;

            while ((rowPos < trs.length) && (trs.length > 0)) {
                trs[trs.length - 1].dispose();
                trs.pop();
            }
        },

        setupTr : function (tr) {},

        updateRow : function (tr, fullUpdate) {
            var row = this.rows.get(tr.rowId);
            data = row[fullUpdate ? 'full_data' : 'data'];

            tds = tr.getElements('td');
            for (var i = 0; i < this.columns.length; i++) {
                if (data.hasOwnProperty(this.columns[i].dataProperties[0]))
                    this.columns[i].updateTd(tds[i], row);
            }
            row['data'] = {};
        },

        removeRow : function (rowId) {
            this.selectedRows.erase(rowId);
            var tr = this.getTrByRowId(rowId);
            if (tr !== null) {
                tr.dispose();
                this.rows.erase(rowId);
                return true;
            }
            return false;
        },

        clear : function () {
            this.selectedRows.empty();
            this.rows.empty();
            var trs = this.tableBody.getElements('tr');
            while (trs.length > 0) {
                trs[trs.length - 1].dispose();
                trs.pop();
            }
        },

        selectedRowsIds : function () {
            return this.selectedRows.slice();
        },

        getRowIds : function () {
            return this.rows.getKeys();
        },
    });

var TorrentsTable = new Class({
        Extends: DynamicTable,

        initColumns : function () {
            this.newColumn('priority', '', '#', 30, true);
            this.newColumn('state_icon', 'cursor: default', '', 22, true);
            this.newColumn('name', '', 'QBT_TR(Name)QBT_TR[CONTEXT=TorrentModel]', 200, true);
            this.newColumn('size', '', 'QBT_TR(Size)QBT_TR[CONTEXT=TorrentModel]', 100, true);
            this.newColumn('progress', '', 'QBT_TR(Done)QBT_TR[CONTEXT=TorrentModel]', 85, true);
            this.newColumn('num_seeds', '', 'QBT_TR(Seeds)QBT_TR[CONTEXT=TorrentModel]', 100, true);
            this.newColumn('num_leechs', '', 'QBT_TR(Peers)QBT_TR[CONTEXT=TorrentModel]', 100, true);
            this.newColumn('dlspeed', '', 'QBT_TR(Down Speed)QBT_TR[CONTEXT=TorrentModel]', 100, true);
            this.newColumn('upspeed', '', 'QBT_TR(Up Speed)QBT_TR[CONTEXT=TorrentModel]', 100, true);
            this.newColumn('eta', '', 'QBT_TR(ETA)QBT_TR[CONTEXT=TorrentModel]', 100, true);
            this.newColumn('ratio', '', 'QBT_TR(Ratio)QBT_TR[CONTEXT=TorrentModel]', 100, true);
            this.newColumn('category', '', 'QBT_TR(Category)QBT_TR[CONTEXT=TorrentModel]', 100, true);
            this.newColumn('added_on', '', 'QBT_TR(Added On)QBT_TR[CONTEXT=TorrentModel]', 100, true);
            this.newColumn('completion_on', '', 'QBT_TR(Completed On)QBT_TR[CONTEXT=TorrentModel]', 100, false);
            this.newColumn('tracker', '', 'QBT_TR(Tracker)QBT_TR[CONTEXT=TorrentModel]', 100, false);
            this.newColumn('dl_limit', '', 'QBT_TR(Down Limit)QBT_TR[CONTEXT=TorrentModel]', 100, false);
            this.newColumn('up_limit', '', 'QBT_TR(Up Limit)QBT_TR[CONTEXT=TorrentModel]', 100, false);
            this.newColumn('downloaded', '', 'QBT_TR(Downloaded)QBT_TR[CONTEXT=TorrentModel]', 100, false);
            this.newColumn('uploaded', '', 'QBT_TR(Uploaded)QBT_TR[CONTEXT=TorrentModel]', 100, false);
            this.newColumn('downloaded_session', '', 'QBT_TR(Session Download)QBT_TR[CONTEXT=TorrentModel]', 100, false);
            this.newColumn('uploaded_session', '', 'QBT_TR(Session Upload)QBT_TR[CONTEXT=TorrentModel]', 100, false);
            this.newColumn('amount_left', '', 'QBT_TR(Remaining)QBT_TR[CONTEXT=TorrentModel]', 100, false);
            this.newColumn('save_path', '', 'QBT_TR(Save path)QBT_TR[CONTEXT=TorrentModel]', 100, false);
            this.newColumn('completed', '', 'QBT_TR(Completed)QBT_TR[CONTEXT=TorrentModel]', 100, false);
            this.newColumn('ratio_limit', '', 'QBT_TR(Ratio Limit)QBT_TR[CONTEXT=TorrentModel]', 100, false);
            this.newColumn('seen_complete', '', 'QBT_TR(Last Seen Complete)QBT_TR[CONTEXT=TorrentModel]', 100, false);
            this.newColumn('last_activity', '', 'QBT_TR(Last Activity)QBT_TR[CONTEXT=TorrentModel]', 100, false);
            this.newColumn('total_size', '', 'QBT_TR(Total Size)QBT_TR[CONTEXT=TorrentModel]', 100, false);

            this.columns['state_icon'].onclick = '';
            this.columns['state_icon'].dataProperties[0] = 'state';

            this.columns['num_seeds'].dataProperties.push('num_complete');

            this.columns['num_leechs'].dataProperties.push('num_incomplete');

            this.initColumnsFunctions();
        },

        initColumnsFunctions : function () {

            // state_icon

            this.columns['state_icon'].updateTd = function (td, row) {
                var state = this.getRowValue(row);

                if (state == "forcedDL" || state == "metaDL")
                    state = "downloading";
                else if (state == "allocating")
                    state = "stalledDL";
                else if (state == "forcedUP")
                    state = "uploading";
                else if (state == "pausedDL")
                    state = "paused";
                else if (state == "pausedUP")
                    state = "completed";
                else if (state == "queuedDL" || state == "queuedUP")
                    state = "queued";
                else if (state == "checkingDL" || state == "checkingUP" ||
                        state == "queuedForChecking" || state == "checkingResumeData")
                    state = "checking";
                else if (state == "unknown" || state == "error" || state == "missingFiles")
                    state = "error";

                var img_path = 'images/skin/' + state + '.png';

                if (td.getChildren('img').length) {
                    var img = td.getChildren('img')[0];
                    if (img.src.indexOf(img_path) < 0)
                        img.set('src', img_path);
                }
                else
                    td.adopt(new Element('img', {
                        'src' : img_path,
                        'class' : 'statusIcon'
                    }));
            };

            // priority

            this.columns['priority'].updateTd = function (td, row) {
                var priority = this.getRowValue(row);
                td.set('html', priority < 1 ? '*' : priority);
            };

            this.columns['priority'].compareRows = function (row1, row2) {
                var row1_val = this.getRowValue(row1);
                var row2_val = this.getRowValue(row2);
                if (row1_val < 1)
                    row1_val = 1000000;
                if (row2_val < 1)
                    row2_val = 1000000;
                if (row1_val < row2_val)
                    return -1;
                else if (row1_val > row2_val)
                    return 1;
                else return 0;
            };

            // name, category

            this.columns['name'].updateTd = function (td, row) {
                td.set('html', escapeHtml(this.getRowValue(row)));
            };
            this.columns['category'].updateTd = this.columns['name'].updateTd;

            // size

            this.columns['size'].updateTd = function (td, row) {
                var size = this.getRowValue(row);
                td.set('html', friendlyUnit(size, false));
            };

            // progress

            this.columns['progress'].updateTd = function (td, row) {
                var progress = this.getRowValue(row);
                var progressFormated = (progress * 100).round(1);
                if (progressFormated == 100.0 && progress != 1.0)
                    progressFormated = 99.9;

                if (td.getChildren('div').length) {
                    var div = td.getChildren('div')[0];
                    if (td.resized) {
                        td.resized = false;
                        div.setWidth(ProgressColumnWidth - 5);
                    }
                    if (div.getValue() != progressFormated)
                        div.setValue(progressFormated);
                }
                else {
                    if (ProgressColumnWidth < 0)
                        ProgressColumnWidth = td.offsetWidth;
                    td.adopt(new ProgressBar(progressFormated.toFloat(), {
                        'width' : ProgressColumnWidth - 5
                    }));
                    td.resized = false;
                }
            };

            this.columns['progress'].onResize = function (columnName) {
                var pos = this.getColumnPos(columnName);
                var trs = this.tableBody.getElements('tr');
                ProgressColumnWidth = -1;
                for (var i = 0; i < trs.length; i++) {
                    var td = trs[i].getElements('td')[pos];
                    if (ProgressColumnWidth < 0)
                        ProgressColumnWidth = td.offsetWidth;
                    td.resized = true;
                    this.columns[columnName].updateTd(td, this.rows.get(trs[i].rowId));
                }
            }.bind(this);

            // num_seeds

            this.columns['num_seeds'].updateTd = function (td, row) {
                var num_seeds = this.getRowValue(row, 0);
                var num_complete = this.getRowValue(row, 1);
                var html = num_seeds;
                if (num_complete != -1)
                    html += ' (' + num_complete + ')';
                td.set('html', html);
            };
            this.columns['num_seeds'].compareRows = function (row1, row2) {
                var num_seeds1 = this.getRowValue(row1, 0);
                var num_complete1 = this.getRowValue(row1, 1);

                var num_seeds2 = this.getRowValue(row2, 0);
                var num_complete2 = this.getRowValue(row2, 1);

                if (num_complete1 < num_complete2)
                    return -1;
                else if (num_complete1 > num_complete2)
                    return 1;
                else if (num_seeds1 < num_seeds2)
                    return -1;
                else if (num_seeds1 > num_seeds2)
                    return 1;
                else return 0;
            };

            // num_leechs

            this.columns['num_leechs'].updateTd = this.columns['num_seeds'].updateTd;
            this.columns['num_leechs'].compareRows = this.columns['num_seeds'].compareRows;

            // dlspeed

            this.columns['dlspeed'].updateTd = function (td, row) {
                var speed = this.getRowValue(row);
                td.set('html', friendlyUnit(speed, true));
            };

            // upspeed

            this.columns['upspeed'].updateTd = this.columns['dlspeed'].updateTd;

            // eta

            this.columns['eta'].updateTd = function (td, row) {
                var eta = this.getRowValue(row);
                td.set('html', friendlyDuration(eta, true));
            };

            // ratio

            this.columns['ratio'].updateTd = function (td, row) {
                var ratio = this.getRowValue(row);
                var html = null;
                if (ratio == -1)
                    html = '∞';
                else
                    html = (Math.floor(100 * ratio) / 100).toFixed(2); //Don't round up
                td.set('html', html);
            };

            // added on

            this.columns['added_on'].updateTd = function (td, row) {
                var date = new Date(this.getRowValue(row) * 1000).toLocaleString();
                td.set('html', date);
            };

            // completion_on

            this.columns['completion_on'].updateTd = function (td, row) {
                var val = this.getRowValue(row);
                if (val === 0xffffffff || val < 0)
                    td.set('html', '');
                else {
                    var date = new Date(this.getRowValue(row) * 1000).toLocaleString();
                    td.set('html', date);
                }
            };

            // seen_complete

            this.columns['seen_complete'].updateTd = this.columns['completion_on'].updateTd;

            //  dl_limit, up_limit

            this.columns['dl_limit'].updateTd = function (td, row) {
                var speed = this.getRowValue(row);
                if (speed === 0)
                    td.set('html', '∞');
                else
                    td.set('html', friendlyUnit(speed, true));
            };

            this.columns['up_limit'].updateTd = this.columns['dl_limit'].updateTd;

            // downloaded, uploaded, downloaded_session, uploaded_session, amount_left, completed, total_size

            this.columns['downloaded'].updateTd = this.columns['size'].updateTd;
            this.columns['uploaded'].updateTd = this.columns['size'].updateTd;
            this.columns['downloaded_session'].updateTd = this.columns['size'].updateTd;
            this.columns['uploaded_session'].updateTd = this.columns['size'].updateTd;
            this.columns['amount_left'].updateTd = this.columns['size'].updateTd;
            this.columns['amount_left'].updateTd = this.columns['size'].updateTd;
            this.columns['completed'].updateTd = this.columns['size'].updateTd;
            this.columns['total_size'].updateTd = this.columns['size'].updateTd;

            // save_path, tracker

            this.columns['save_path'].updateTd = this.columns['name'].updateTd;
            this.columns['tracker'].updateTd = this.columns['name'].updateTd;

            // ratio_limit

            this.columns['ratio_limit'].updateTd = this.columns['ratio'].updateTd;

            // last_activity

            this.columns['last_activity'].updateTd = function (td, row) {
                var val = this.getRowValue(row);
                if (val < 1)
                    td.set('html', '∞');
                else
                    td.set('html', 'QBT_TR(%1 ago)QBT_TR[CONTEXT=TransferListDelegate]'.replace('%1', friendlyDuration((new Date()) / 1000 - val, true)));
            };
        },

        applyFilter : function (row, filterName, categoryHash) {
            var state = row['full_data'].state;
            var inactive = false;
            var r;

            switch(filterName) {
                case 'downloading':
                    if (state != 'downloading' && !~state.indexOf('DL'))
                        return false;
                    break;
                case 'seeding':
                    if (state != 'uploading' && state != 'forcedUP' && state != 'stalledUP' && state != 'queuedUP' && state != 'checkingUP')
                        return false;
                    break;
                case 'completed':
                    if (state != 'uploading' && !~state.indexOf('UP'))
                        return false;
                    break;
                case 'paused':
                    if (!~state.indexOf('paused'))
                        return false;
                    break;
                case 'resumed':
                    if (~state.indexOf('paused'))
                        return false;
                    break;
                case 'inactive':
                    inactive = true;
                    // fallthrough
                case 'active':
                    if (state == 'stalledDL')
                        r = (row['full_data'].upspeed > 0);
                    else
                        r = state == 'metaDL' || state == 'downloading' || state == 'forcedDL' || state == 'uploading' || state == 'forcedUP';
                    if (r == inactive)
                        return false;
                    break;
                case 'errored':
                    if (state != 'error' && state != "unknown" && state != "missingFiles")
                        return false;
                    break;
            }

            if (categoryHash == CATEGORIES_ALL)
                return true;

            if (categoryHash == CATEGORIES_UNCATEGORIZED && row['full_data'].category.length === 0)
                return true;

            if (categoryHash != genHash(row['full_data'].category))
                return false;

            return true;
        },

        getFilteredTorrentsNumber : function (filterName, categoryHash) {
            var cnt = 0;
            var rows = this.rows.getValues();

            for (i = 0; i < rows.length; i++)
                if (this.applyFilter(rows[i], filterName, categoryHash)) cnt++;
            return cnt;
        },

        getFilteredTorrentsHashes : function (filterName, categoryHash) {
            var rowsHashes = [];
            var rows = this.rows.getValues();

            for (i = 0; i < rows.length; i++)
                if (this.applyFilter(rows[i], filterName, categoryHash))
                    rowsHashes.push(rows[i]['rowId']);

            return rowsHashes;
        },

        getFilteredAndSortedRows : function () {
            var filteredRows = [];

            var rows = this.rows.getValues();

            for (i = 0; i < rows.length; i++)
                if (this.applyFilter(rows[i], selected_filter, selected_category)) {
                    filteredRows.push(rows[i]);
                    filteredRows[rows[i].rowId] = rows[i];
                }

            filteredRows.sort(function (row1, row2) {
                var column = this.columns[this.sortedColumn];
                res = column.compareRows(row1, row2);
                if (this.reverseSort == '0')
                    return res;
                else
                    return -res;
            }.bind(this));
            return filteredRows;
        },

        setupTr : function (tr) {
            tr.addEvent('dblclick', function (e) {
                e.stop();
                this._this.selectRow(this.rowId);
                var row = this._this.rows.get(this.rowId);
                var state = row['full_data'].state;
                if (~state.indexOf('paused'))
                    startFN();
                else
                    pauseFN();
                return true;
            });
            tr.addClass("torrentsTableContextMenuTarget");
        },

        getCurrentTorrentHash : function () {
            return this.getSelectedRowId();
        },

        onSelectedRowChanged : function () {
            updatePropertiesPanel();
        }
    });

var TorrentPeersTable = new Class({
        Extends: DynamicTable,

        initColumns : function () {
            this.newColumn('country', '', 'QBT_TR(Country)QBT_TR[CONTEXT=PeerListWidget]', 22, true);
            this.newColumn('ip', '', 'QBT_TR(IP)QBT_TR[CONTEXT=PeerListWidget]', 80, true);
            this.newColumn('port', '', 'QBT_TR(Port)QBT_TR[CONTEXT=PeerListWidget]', 35, true);
            this.newColumn('client', '', 'QBT_TR(Client)QBT_TR[CONTEXT=PeerListWidget]', 140, true);
            this.newColumn('progress', '', 'QBT_TR(Progress)QBT_TR[CONTEXT=PeerListWidget]', 50, true);
            this.newColumn('dl_speed', '', 'QBT_TR(Down Speed)QBT_TR[CONTEXT=PeerListWidget]', 50, true);
            this.newColumn('up_speed', '', 'QBT_TR(Up Speed)QBT_TR[CONTEXT=PeerListWidget]', 50, true);
            this.newColumn('downloaded', '', 'QBT_TR(Downloaded)QBT_TR[CONTEXT=PeerListWidget]', 50, true);
            this.newColumn('uploaded', '', 'QBT_TR(Uploaded)QBT_TR[CONTEXT=PeerListWidget]', 50, true);
            this.newColumn('connection', '', 'QBT_TR(Connection)QBT_TR[CONTEXT=PeerListWidget]', 50, true);
            this.newColumn('flags', '', 'QBT_TR(Flags)QBT_TR[CONTEXT=PeerListWidget]', 50, true);
            this.newColumn('relevance', '', 'QBT_TR(Relevance)QBT_TR[CONTEXT=PeerListWidget]', 30, true);
            this.newColumn('files', '', 'QBT_TR(Files)QBT_TR[CONTEXT=PeerListWidget]', 100, true);

            this.columns['country'].dataProperties.push('country_code');
            this.columns['flags'].dataProperties.push('flags_desc');
            this.initColumnsFunctions();
        },

        initColumnsFunctions : function () {

            // country

            this.columns['country'].updateTd = function (td, row) {
                var country = this.getRowValue(row, 0);
                var country_code = this.getRowValue(row, 1);

                if (!country_code) {
                    if (td.getChildren('img').length)
                        td.getChildren('img')[0].dispose();
                    return;
                }

                var img_path = 'images/flags/' + country_code + '.png';

                if (td.getChildren('img').length) {
                    var img = td.getChildren('img')[0];
                    img.set('src', img_path);
                    img.set('alt', country);
                    img.set('title', country);
                }
                else
                    td.adopt(new Element('img', {
                        'src' : img_path,
                        'alt' : country,
                        'title' : country
                    }));
            };

            // ip

            this.columns['ip'].compareRows = function (row1, row2) {
                var ip1 = this.getRowValue(row1);
                var ip2 = this.getRowValue(row2);

                var a = ip1.split(".");
                var b = ip2.split(".");

                for (var i = 0; i < 4; i++){
                    if (a[i] != b[i])
                        return a[i] - b[i];
                }

                return 0;
            };

            // progress, relevance

            this.columns['progress'].updateTd = function (td, row) {
                var progress = this.getRowValue(row);
                var progressFormated = (progress * 100).round(1);
                if (progressFormated == 100.0 && progress != 1.0)
                    progressFormated = 99.9;
                progressFormated += "%";
                td.set('html', progressFormated);
            };

            this.columns['relevance'].updateTd = this.columns['progress'].updateTd;

            // dl_speed, up_speed

            this.columns['dl_speed'].updateTd = function (td, row) {
                var speed = this.getRowValue(row);
                if (speed === 0)
                    td.set('html', '');
                else
                    td.set('html', friendlyUnit(speed, true));
            };

            this.columns['up_speed'].updateTd = this.columns['dl_speed'].updateTd;

            // downloaded, uploaded

            this.columns['downloaded'].updateTd = function (td, row) {
                var downloaded = this.getRowValue(row);
                td.set('html', friendlyUnit(downloaded, false));
            };

            this.columns['uploaded'].updateTd = this.columns['downloaded'].updateTd;

            // flags

            this.columns['flags'].updateTd = function (td, row) {
                td.innerHTML = this.getRowValue(row, 0);
                td.title = this.getRowValue(row, 1);
            };

            // files

            this.columns['files'].updateTd = function (td, row) {
                td.innerHTML = escapeHtml(this.getRowValue(row, 0).replace('\n', ';'));
                td.title = escapeHtml(this.getRowValue(row, 0));
            };

        }
    });

/*************************************************************/
