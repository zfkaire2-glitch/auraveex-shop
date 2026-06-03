(function() {
  'use strict';

  var sections = (typeof __sections !== 'undefined' && __sections) || [];
  var selectedId = null;
  var saveTimer = null;
  var isSaving = false;

  var iframe = document.getElementById('bdrPreviewFrame');
  var panelContent = document.getElementById('bdrPanelContent');
  var panelEmpty = document.getElementById('bdrPanelEmpty');
  var panelFields = document.getElementById('bdrPanelFields');
  var sectionLabel = document.getElementById('bdrSectionLabel');
  var sectionsList = document.getElementById('bdrSectionsList');
  var statusEl = document.getElementById('bdrStatus');
  var btnSave = document.getElementById('bdrBtnSave');

  var SECTION_TYPES = {
    hero: {
      label: 'القسم الرئيسي', icon: '🏠', desc: 'صورة خلفية + عنوان + زر', color: '#6366f1',
      fields: function(s) {
        return [
          { key: 'backgroundImage', label: 'صورة الخلفية', type: 'text', placeholder: 'رابط الصورة' },
          { key: 'badge', label: 'الشارة', type: 'text', placeholder: 'مثال: 🇩🇿 متجر جزائري 100%' },
          { key: 'title', label: 'العنوان', type: 'text', placeholder: 'مثال: AURA <span>VEEX</span>' },
          { key: 'subtitle', label: 'النص الفرعي', type: 'text', placeholder: 'وصف قصير' },
          { key: 'ctaText', label: 'نص الزر', type: 'text', placeholder: 'تسوق الآن' },
          { key: 'ctaLink', label: 'رابط الزر', type: 'text', placeholder: '/products' },
          { key: 'stats', label: 'الإحصائيات', type: 'array', subFields: [{ key: 'icon', label: 'أيقونة', placeholder: '⭐' }, { key: 'title', label: 'نص', placeholder: 'جودة عالية' }] }
        ];
      }
    },
    categories: {
      label: 'الأقسام', icon: '📂', desc: 'شبكة أقسام المنتجات', color: '#8b5cf6',
      fields: function() { return [{ key: 'heading', label: 'العنوان', type: 'text', placeholder: 'الأقسام' }]; }
    },
    featured_products: {
      label: 'منتجات مميزة', icon: '👕', desc: 'شبكة منتجات محددة', color: '#ec4899',
      fields: function() {
        return [
          { key: 'heading', label: 'العنوان', type: 'text', placeholder: 'منتجات مميزة' },
          { key: 'count', label: 'عدد المنتجات', type: 'number', placeholder: '4' }
        ];
      }
    },
    trust_badges: {
      label: 'شارات الثقة', icon: '⭐', desc: 'قائمة نقاط القوة', color: '#f59e0b',
      fields: function(s) {
        return [
          { key: 'heading', label: 'العنوان', type: 'text', placeholder: 'لماذا AURA VEEX؟' },
          { key: 'badges', label: 'الشارات', type: 'array', subFields: [{ key: 'icon', label: 'أيقونة', placeholder: '⭐' }, { key: 'title', label: 'نص', placeholder: 'جودة عالية' }] }
        ];
      }
    },
    text_block: {
      label: 'نص', icon: '📝', desc: 'عنوان + محتوى نصي', color: '#14b8a6',
      fields: function() {
        return [
          { key: 'heading', label: 'العنوان', type: 'text', placeholder: 'عنوان القسم' },
          { key: 'content', label: 'المحتوى', type: 'textarea', placeholder: 'محتوى النص...' },
          { key: 'alignment', label: 'المحاذاة', type: 'select', options: [{ value: 'right', label: 'يمين' }, { value: 'center', label: 'وسط' }, { value: 'left', label: 'يسار' }] }
        ];
      }
    },
    image_banner: {
      label: 'بانر صورة', icon: '🖼', desc: 'صورة بعرض كامل', color: '#3b82f6',
      fields: function() {
        return [
          { key: 'image', label: 'رابط الصورة', type: 'text', placeholder: 'https://...' },
          { key: 'link', label: 'الرابط (اختياري)', type: 'text', placeholder: '/products' },
          { key: 'alt', label: 'نص بديل', type: 'text', placeholder: 'وصف الصورة' }
        ];
      }
    },
    divider: {
      label: 'فاصل', icon: '➖', desc: 'خط فاصل', color: '#6b7280',
      fields: function() { return [{ key: 'spacing', label: 'المسافة', type: 'text', placeholder: '2rem' }]; }
    },
    custom_html: {
      label: 'HTML مخصص', icon: '🔧', desc: 'كود HTML حر', color: '#ef4444',
      fields: function() { return [{ key: 'html', label: 'محتوى HTML', type: 'textarea', placeholder: '<div>...</div>' }]; }
    }
  };

  var NEW_SECTION_DEFAULTS = {
    hero: {
      backgroundImage: '/uploads/hero-eagle.jpg', badge: '🇩🇿 متجر جزائري 100%',
      title: 'AURA <span>VEEX</span>', subtitle: 'وصف المتجر',
      ctaText: 'تسوق الآن', ctaLink: '/products',
      stats: [{ icon: '⭐', title: 'جودة' }, { icon: '🚚', title: 'توصيل' }, { icon: '💳', title: 'الدفع عند الاستلام' }]
    },
    categories: { heading: 'الأقسام' },
    featured_products: { heading: 'منتجات مميزة', count: 4 },
    trust_badges: { heading: 'لماذا AURA VEEX؟', badges: [{ icon: '⭐', title: 'جودة عالية' }] },
    text_block: { heading: 'عنوان', content: 'محتوى النص...', alignment: 'center' },
    image_banner: { image: '', link: '', alt: '' },
    divider: { spacing: '2rem' },
    custom_html: { html: '<div style="padding:2rem;text-align:center;color:var(--text-secondary)">محتوى مخصص</div>' }
  };

  function init() {
    renderSectionsList();
    listenIframe();
    setupEvents();
    if (sections.length > 0) selectSection(sections[0].id);
  }

  function setupEvents() {
    btnSave.addEventListener('click', saveNow);
    document.getElementById('bdrBtnDelete').addEventListener('click', deleteSection);
    document.getElementById('bdrBtnDuplicate').addEventListener('click', duplicateSection);
    document.getElementById('bdrBtnToggle').addEventListener('click', toggleSection);
    document.getElementById('bdrBtnAdd').addEventListener('click', openModal);
    document.getElementById('bdrBtnCloseModal').addEventListener('click', closeModal);
    document.getElementById('bdrModalOverlay').addEventListener('click', closeModal);
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeModal();
    });
  }

  function listenIframe() {
    window.addEventListener('message', function(e) {
      var d = e.data;
      if (!d) return;
      if (d.type === 'sectionClicked') selectSection(d.sectionId);
      if (d.type === 'previewReady' && selectedId) highlightInIframe(selectedId);
    });
  }

  function highlightInIframe(id) {
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'highlightSection', sectionId: id }, '*');
    }
  }

  function refreshPreview() {
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'refreshPreview' }, '*');
    }
  }

  function selectSection(id) {
    selectedId = id;
    var section = sections.find(function(s) { return s.id === id; });
    if (!section) return;
    var td = SECTION_TYPES[section.type];
    sectionLabel.textContent = (td ? td.icon + ' ' : '') + (section.label || td?.label || section.type);
    panelEmpty.style.display = 'none';
    panelContent.style.display = 'block';
    renderFields(section);
    renderSectionsList();
    highlightInIframe(id);
    scrollTabIntoView(id);
  }

  function scrollTabIntoView(id) {
    var tab = document.querySelector('.bdr-section-tab[data-id="' + id + '"]');
    if (tab) tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  function showPanelEmpty() {
    selectedId = null;
    panelEmpty.style.display = 'flex';
    panelContent.style.display = 'none';
    renderSectionsList();
    highlightInIframe(null);
  }

  function renderFields(section) {
    var td = SECTION_TYPES[section.type];
    if (!td) { panelFields.innerHTML = '<p style="color:#888">نوع القسم غير معروف</p>'; return; }
    var fields = td.fields(section.settings);
    panelFields.innerHTML = '';
    // Enable/disable toggle
    var toggleRow = document.createElement('div');
    toggleRow.className = 'bdr-field bdr-toggle-row';
    toggleRow.innerHTML = '<label>القسم مفعل</label><label class="bdr-switch"><input type="checkbox" id="bdrToggleCheck"' + (section.enabled !== false ? ' checked' : '') + '><span class="bdr-slider"></span></label>';
    toggleRow.querySelector('#bdrToggleCheck').addEventListener('change', function() {
      section.enabled = this.checked;
      debouncedSave();
      refreshPreview();
    });
    panelFields.appendChild(toggleRow);
    fields.forEach(function(f) {
      var el = createField(f, section);
      if (el) panelFields.appendChild(el);
    });
  }

  function createField(field, section) {
    if (field.type === 'array') return createArrayField(field, section);
    var div = document.createElement('div');
    div.className = 'bdr-field';
    var label = document.createElement('label');
    label.textContent = field.label;
    div.appendChild(label);
    var val = section.settings[field.key] !== undefined ? section.settings[field.key] : '';
    if (field.type === 'textarea') {
      var ta = document.createElement('textarea');
      ta.value = val; ta.placeholder = field.placeholder || '';
      ta.addEventListener('input', function() { updateSetting(section, field.key, ta.value); });
      div.appendChild(ta);
    } else if (field.type === 'select') {
      var sel = document.createElement('select');
      (field.options || []).forEach(function(opt) {
        var op = document.createElement('option');
        op.value = opt.value; op.textContent = opt.label;
        if (opt.value === val) op.selected = true;
        sel.appendChild(op);
      });
      sel.addEventListener('change', function() { updateSetting(section, field.key, sel.value); });
      div.appendChild(sel);
    } else if (field.type === 'number') {
      var ni = document.createElement('input');
      ni.type = 'number'; ni.value = val; ni.placeholder = field.placeholder || '';
      ni.addEventListener('input', function() { updateSetting(section, field.key, parseFloat(ni.value) || 0); });
      div.appendChild(ni);
    } else {
      var inp = document.createElement('input');
      inp.type = 'text'; inp.value = val; inp.placeholder = field.placeholder || '';
      inp.addEventListener('input', function() { updateSetting(section, field.key, inp.value); });
      div.appendChild(inp);
    }
    if (field.hint) {
      var hint = document.createElement('div');
      hint.className = 'bdr-field-hint'; hint.textContent = field.hint;
      div.appendChild(hint);
    }
    return div;
  }

  function createArrayField(field, section) {
    var div = document.createElement('div');
    div.className = 'bdr-array-field';
    var header = document.createElement('div');
    header.className = 'bdr-array-field-header';
    var label = document.createElement('label');
    label.textContent = field.label;
    header.appendChild(label);
    div.appendChild(header);
    var list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:8px';
    div.appendChild(list);
    function renderItems() {
      list.innerHTML = '';
      var arr = section.settings[field.key] || [];
      arr.forEach(function(item, idx) {
        var itemDiv = document.createElement('div');
        itemDiv.className = 'bdr-array-item';
        var row = document.createElement('div');
        row.className = 'bdr-array-item-row';
        (field.subFields || []).forEach(function(sf) {
          var inp = document.createElement('input');
          inp.value = item[sf.key] || '';
          inp.placeholder = sf.placeholder || '';
          inp.addEventListener('input', function() {
            section.settings[field.key][idx][sf.key] = inp.value;
            debouncedSave(); refreshPreview();
          });
          row.appendChild(inp);
        });
        var delBtn = document.createElement('button');
        delBtn.className = 'bdr-btn-icon'; delBtn.textContent = '✕';
        delBtn.addEventListener('click', function() {
          section.settings[field.key].splice(idx, 1);
          renderItems(); debouncedSave(); refreshPreview();
        });
        row.appendChild(delBtn);
        itemDiv.appendChild(row);
        list.appendChild(itemDiv);
      });
      var addBtn = document.createElement('button');
      addBtn.className = 'bdr-array-add'; addBtn.textContent = '+ إضافة';
      addBtn.addEventListener('click', function() {
        var obj = {};
        (field.subFields || []).forEach(function(sf) { obj[sf.key] = ''; });
        if (!section.settings[field.key]) section.settings[field.key] = [];
        section.settings[field.key].push(obj);
        renderItems(); debouncedSave(); refreshPreview();
      });
      list.appendChild(addBtn);
    }
    renderItems();
    return div;
  }

  function updateSetting(section, key, val) {
    section.settings[key] = val;
    debouncedSave();
    refreshPreview();
  }

  function toggleSection() {
    var section = sections.find(function(s) { return s.id === selectedId; });
    if (!section) return;
    section.enabled = section.enabled !== false ? false : true;
    renderSectionsList();
    var toggleCheck = document.getElementById('bdrToggleCheck');
    if (toggleCheck) toggleCheck.checked = section.enabled !== false;
    debouncedSave();
    refreshPreview();
  }

  function duplicateSection() {
    if (!selectedId) return;
    var idx = sections.findIndex(function(s) { return s.id === selectedId; });
    if (idx === -1) return;
    var copy = JSON.parse(JSON.stringify(sections[idx]));
    copy.id = copy.id + '_copy_' + Date.now();
    copy.label = copy.label + ' (نسخة)';
    sections.splice(idx + 1, 0, copy);
    renderSectionsList();
    saveNow();
    selectSection(copy.id);
  }

  function deleteSection() {
    if (!selectedId) return;
    if (sections.length <= 1) { setStatus('لا يمكن حذف آخر قسم', 'error'); return; }
    if (!confirm('حذف هذا القسم؟')) return;
    sections = sections.filter(function(s) { return s.id !== selectedId; });
    renderSectionsList();
    saveNow();
    showPanelEmpty();
  }

  function openModal() {
    var overlay = document.getElementById('bdrModalOverlay');
    var modal = document.getElementById('bdrModal');
    var grid = document.getElementById('bdrModalGrid');
    grid.innerHTML = '';
    Object.keys(SECTION_TYPES).forEach(function(type) {
      var def = SECTION_TYPES[type];
      var card = document.createElement('div');
      card.className = 'bdr-modal-card';
      card.style.borderTopColor = def.color || '#444';
      card.style.borderTopWidth = '3px';
      card.innerHTML = '<div class="bdr-modal-card-icon">' + def.icon + '</div><h4>' + def.label + '</h4><p>' + def.desc + '</p>';
      card.addEventListener('click', function() { addSection(type); });
      grid.appendChild(card);
    });
    overlay.style.display = 'block';
    modal.style.display = 'block';
  }

  function closeModal() {
    document.getElementById('bdrModalOverlay').style.display = 'none';
    document.getElementById('bdrModal').style.display = 'none';
  }

  function addSection(type) {
    var def = NEW_SECTION_DEFAULTS[type];
    if (!def) return;
    var section = {
      id: type + '_' + Date.now(),
      type: type,
      label: SECTION_TYPES[type]?.label || type,
      enabled: true,
      settings: JSON.parse(JSON.stringify(def))
    };
    sections.push(section);
    renderSectionsList();
    saveNow();
    selectSection(section.id);
    closeModal();
  }

  function renderSectionsList() {
    sectionsList.innerHTML = '';
    sections.forEach(function(s, idx) {
      var td = SECTION_TYPES[s.type];
      var icon = td ? td.icon : '📄';
      var tab = document.createElement('div');
      tab.className = 'bdr-section-tab' + (s.id === selectedId ? ' active' : '') + (s.enabled === false ? ' disabled' : '');
      tab.draggable = true; tab.dataset.index = idx; tab.dataset.id = s.id;
      tab.innerHTML = '<span class="bdr-drag">⠿</span><span class="bdr-section-icon">' + icon + '</span><span class="bdr-section-label">' + (s.label || s.type) + '</span>';
      tab.title = (s.enabled === false ? 'مخفي - ' : '') + (td?.label || s.type);
      tab.addEventListener('click', function() { selectSection(s.id); });
      tab.addEventListener('dragstart', function(e) { e.dataTransfer.setData('text/plain', idx); tab.classList.add('dragging'); });
      tab.addEventListener('dragend', function() { tab.classList.remove('dragging'); });
      tab.addEventListener('dragover', function(e) { e.preventDefault(); tab.classList.add('drag-over'); });
      tab.addEventListener('dragleave', function() { tab.classList.remove('drag-over'); });
      tab.addEventListener('drop', function(e) {
        e.preventDefault(); tab.classList.remove('drag-over');
        var fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
        if (fromIdx === idx) return;
        var item = sections.splice(fromIdx, 1)[0];
        sections.splice(idx, 0, item);
        renderSectionsList();
        debouncedSave();
        refreshPreview();
      });
      sectionsList.appendChild(tab);
    });
  }

  function debouncedSave() {
    setStatus('جاري الحفظ...', 'saving');
    if (btnSave) btnSave.classList.add('bdr-btn-loading');
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 600);
  }

  function saveNow() {
    if (isSaving) return;
    isSaving = true;
    setStatus('جاري الحفظ...', 'saving');
    if (btnSave) btnSave.classList.add('bdr-btn-loading');
    fetch('/admin/builder/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sections: sections })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success) {
        setStatus('✓ تم الحفظ', 'saved');
        refreshPreview();
      } else {
        setStatus('✗ فشل الحفظ', 'error');
      }
    })
    .catch(function() {
      setStatus('✗ خطأ في الاتصال', 'error');
    })
    .then(function() {
      isSaving = false;
      if (btnSave) btnSave.classList.remove('bdr-btn-loading');
    });
  }

  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.style.color = type === 'saved' ? '#4ade80' : type === 'error' ? '#ef4444' : type === 'saving' ? '#d4a853' : '#888';
    if (type === 'saved') {
      setTimeout(function() { statusEl.style.color = '#888'; }, 3000);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
