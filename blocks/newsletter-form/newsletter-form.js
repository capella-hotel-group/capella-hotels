(function(){
  const block = document.querySelector('.newsletter-form-block');
  if(!block) return;
  const form = block.querySelector('.newsletter-form');

  function getPropertyCodename(){
    const meta = document.querySelector('meta[name="property-codename"]');
    if(meta && meta.content) return meta.content;
    if(block && block.dataset.property) return block.dataset.property;
    return '';
  }

  function getLanguage(){
    const htmlLang = document.documentElement.lang || document.querySelector('meta[name="locale"]') && document.querySelector('meta[name="locale"]').content;
    if(!htmlLang) return 'en';
    return htmlLang.split('-')[0];
  }

  function generateTimestamp(){
    return new Date().toISOString().replace('Z','');
  }

  function setAutoFields(){
    const property = getPropertyCodename();
    block.querySelector('#property').value = property;
    block.querySelector('#language').value = getLanguage();
    block.querySelector('#timestamp').value = generateTimestamp();
    block.querySelector('#source').value = property;
  }

  setAutoFields();

  form.addEventListener('submit', function(e){
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const msg = form.querySelector('.newsletter-message');
    msg.textContent = '';

    if(!form.checkValidity()){
      msg.textContent = 'Please fill all required fields correctly.';
      form.reportValidity();
      return;
    }

    const payload = {
      Email: form.querySelector('[name="Email"]').value.trim(),
      Salutation: form.querySelector('[name="Salutation"]').value,
      FirstName: form.querySelector('[name="FirstName"]').value.trim(),
      LastName: form.querySelector('[name="LastName"]').value.trim(),
      Country: form.querySelector('[name="Country"]').value,
      Property: block.querySelector('#property').value,
      Timestamp: block.querySelector('#timestamp').value,
      Language: block.querySelector('#language').value,
      Consent: block.querySelector('#consentValue').value,
      Source: block.querySelector('#source').value
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    const endpoint = block.dataset.endpoint || '/api/leads';

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r=>{
      submitBtn.disabled = false;
      submitBtn.textContent = 'Continue';
      if(r.ok){
        msg.textContent = 'Thank you — your subscription has been received.';
        form.reset();
        setAutoFields();
      } else {
        msg.textContent = 'Sorry, something went wrong. Please try again later.';
      }
    }).catch(err=>{
      submitBtn.disabled = false;
      submitBtn.textContent = 'Continue';
      msg.textContent = 'Network error — please check your connection and try again.';
    });
  });
})();
