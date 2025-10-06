// week08/frontend/main.js
/* eslint-env browser */
/* global document, window, fetch, confirm */

document.addEventListener('DOMContentLoaded', () => {
  // Values are injected by the CD pipeline via sed.
  // They may be full URLs (http://IP:PORT) or just host/IP.
  const PRODUCT_API_BASE_URL = '_PRODUCT_API_URL_';
  const ORDER_API_BASE_URL   = '_ORDER_API_URL_';

  // Normalize base to an absolute origin with default port if needed.
  function normalizeBase(base, defaultPort) {
    try {
      const withScheme = base.startsWith('http://') || base.startsWith('https://')
        ? base
        : `http://${base}`;
      const u = new URL(withScheme);
      if (!u.port) u.port = String(defaultPort);
      // return origin only, e.g. http://1.2.3.4:8000
      return `${u.protocol}//${u.hostname}${u.port ? ':' + u.port : ''}`;
    } catch (e) {
      console.warn('Could not normalize base URL, using as-is:', base, e);
      return base;
    }
  }

  const PRODUCT_BASE = normalizeBase(PRODUCT_API_BASE_URL, 8000);
  const ORDER_BASE   = normalizeBase(ORDER_API_BASE_URL, 8001);

  // Helpful logs (check DevTools console once the page loads)
  console.log('[Frontend] PRODUCT_BASE:', PRODUCT_BASE);
  console.log('[Frontend] ORDER_BASE  :', ORDER_BASE);

  // DOM elements
  const messageBox      = document.getElementById('message-box');
  const productForm     = document.getElementById('product-form');
  const productListDiv  = document.getElementById('product-list');
  const cartItemsList   = document.getElementById('cart-items');
  const cartTotalSpan   = document.getElementById('cart-total');
  const placeOrderForm  = document.getElementById('place-order-form');
  const orderListDiv    = document.getElementById('order-list');

  // Shopping Cart state
  let cart = [];
  let productsCache = {};

  // ---------- Utilities ----------
  function showMessage(message, type = 'info') {
    messageBox.textContent = message;
    messageBox.className = `message-box ${type}`;
    messageBox.style.display = 'block';
    setTimeout(() => (messageBox.style.display = 'none'), 5000);
  }

  function formatCurrency(amount) {
    return `$${parseFloat(amount).toFixed(2)}`;
  }

  // ---------- Product Service ----------
  async function fetchProducts() {
    productListDiv.innerHTML = '<p>Loading products...</p>';
    const url = `${PRODUCT_BASE}/products/`; // keep trailing slash for FastAPI
    console.log('Attempting to fetch products from URL:', url);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        let detail = `HTTP error! status: ${response.status}`;
        try { detail = (await response.json()).detail || detail; } catch {}
        throw new Error(detail);
      }
      const products = await response.json();

      productListDiv.innerHTML = '';
      productsCache = {};

      if (!products.length) {
        productListDiv.innerHTML = '<p>No products available yet. Add some above!</p>';
        return;
      }

      products.forEach(product => {
        productsCache[product.product_id] = product;

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
          <img src="${product.image_url || 'https://placehold.co/300x200/cccccc/333333?text=No+Image'}"
               alt="${product.name}"
               onerror="this.onerror=null;this.src='https://placehold.co/300x200/cccccc/333333?text=Image+Error';" />
          <h3>${product.name} (ID: ${product.product_id})</h3>
          <p>${product.description || 'No description available.'}</p>
          <p class="price">${formatCurrency(product.price)}</p>
          <p class="stock">Stock: ${product.stock_quantity}</p>
          <p><small>Created: ${new Date(product.created_at).toLocaleString()}</small></p>
          <p><small>Last Updated: ${product.updated_at ? new Date(product.updated_at).toLocaleString() : '—'}</small></p>

          <div class="upload-image-group">
            <label for="image-upload-${product.product_id}">Upload Image:</label>
            <input type="file" id="image-upload-${product.product_id}" accept="image/*" data-product-id="${product.product_id}">
            <button class="upload-btn" data-id="${product.product_id}">Upload Photo</button>
          </div>

          <div class="card-actions">
            <button class="add-to-cart-btn"
                    data-id="${product.product_id}"
                    data-name="${product.name}"
                    data-price="${product.price}">
              Add to Cart
            </button>
            <button class="delete-btn" data-id="${product.product_id}">Delete</button>
          </div>
        `;
        productListDiv.appendChild(card);
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      showMessage(`Failed to load products: ${error.message}`, 'error');
      productListDiv.innerHTML = '<p>Could not load products. Please check the Product Service.</p>';
    }
  }

  productForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name           = document.getElementById('product-name').value;
    const price          = parseFloat(document.getElementById('product-price').value);
    const stock_quantity = parseInt(document.getElementById('product-stock').value, 10);
    const description    = document.getElementById('product-description').value;

    const newProduct = { name, price, stock_quantity, description };

    try {
      const response = await fetch(`${PRODUCT_BASE}/products/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProduct),
      });

      if (!response.ok) {
        let detail = `HTTP error! status: ${response.status}`;
        try { detail = (await response.json()).detail || detail; } catch {}
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
      }

      const added = await response.json();
      showMessage(`Product "${added.name}" added! ID: ${added.product_id}`, 'success');
      productForm.reset();
      fetchProducts();
    } catch (error) {
      console.error('Error adding product:', error);
      showMessage(`Error adding product: ${error.message}`, 'error');
    }
  });

  productListDiv.addEventListener('click', async (event) => {
    // Delete
    if (event.target.classList.contains('delete-btn')) {
      const productId = event.target.dataset.id;
      if (!confirm(`Delete product ID: ${productId}?`)) return;

      try {
        const response = await fetch(`${PRODUCT_BASE}/products/${productId}`, { method: 'DELETE' });
        if (response.status === 204) {
          showMessage(`Product ${productId} deleted.`, 'success');
          fetchProducts();
        } else {
          let detail = `HTTP error! status: ${response.status}`;
          try { detail = (await response.json()).detail || detail; } catch {}
          throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
        }
      } catch (error) {
        console.error('Error deleting product:', error);
        showMessage(`Error deleting product: ${error.message}`, 'error');
      }
    }

    // Add to cart
    if (event.target.classList.contains('add-to-cart-btn')) {
      const { id, name, price } = event.target.dataset;
      addToCart(id, name, parseFloat(price));
    }

    // Upload image
    if (event.target.classList.contains('upload-btn')) {
      const productId = event.target.dataset.id;
      const fileInput = document.getElementById(`image-upload-${productId}`);
      const file = fileInput.files[0];
      if (!file) return showMessage('Please select an image file.', 'info');

      const formData = new FormData();
      formData.append('file', file);

      try {
        showMessage(`Uploading image for product ${productId}...`, 'info');
        const response = await fetch(`${PRODUCT_BASE}/products/${productId}/upload-image`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          let detail = `HTTP error! status: ${response.status}`;
          try { detail = (await response.json()).detail || detail; } catch {}
          throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
        }

        await response.json();
        showMessage('Image uploaded!', 'success');
        fileInput.value = '';
        fetchProducts();
      } catch (error) {
        console.error('Error uploading image:', error);
        showMessage(`Error uploading image: ${error.message}`, 'error');
      }
    }
  });

  // ---------- Cart ----------
  function addToCart(productId, productName, productPrice) {
    const idx = cart.findIndex(i => i.product_id === productId);
    if (idx !== -1) {
      cart[idx].quantity += 1;
    } else {
      cart.push({ product_id: productId, name: productName, price: productPrice, quantity: 1 });
    }
    updateCartDisplay();
    showMessage(`Added "${productName}" to cart!`, 'info');
  }

  function updateCartDisplay() {
    cartItemsList.innerHTML = '';
    let total = 0;

    if (!cart.length) {
      cartItemsList.innerHTML = '<li>Your cart is empty.</li>';
    } else {
      cart.forEach(item => {
        const li = document.createElement('li');
        const itemTotal = item.quantity * item.price;
        total += itemTotal;
        li.innerHTML = `
          <span>${item.name} (x${item.quantity})</span>
          <span>${formatCurrency(item.price)} each - ${formatCurrency(itemTotal)}</span>
        `;
        cartItemsList.appendChild(li);
      });
    }
    cartTotalSpan.textContent = `Total: ${formatCurrency(total)}`;
  }

  // ---------- Order Service ----------
  placeOrderForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!cart.length) return showMessage('Your cart is empty. Add products first.', 'info');

    const userId = parseInt(document.getElementById('order-user-id').value, 10);
    const shippingAddress = document.getElementById('shipping-address').value;

    const items = cart.map(item => ({
      product_id: parseInt(item.product_id, 10),
      quantity: item.quantity,
      price_at_purchase: item.price,
    }));

    const newOrder = { user_id: userId, shipping_address: shippingAddress, items };

    try {
      showMessage('Placing order...', 'info');
      const response = await fetch(`${ORDER_BASE}/orders/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder),
      });

      if (!response.ok) {
        let detail = `HTTP error! status: ${response.status}`;
        try { detail = (await response.json()).detail || detail; } catch {}
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
      }

      const placed = await response.json();
      showMessage(`Order ${placed.order_id} placed! Total: ${formatCurrency(placed.total_amount)}`, 'success');
      cart = [];
      updateCartDisplay();
      placeOrderForm.reset();
      fetchOrders();
      fetchProducts(); // refresh stock
    } catch (error) {
      console.error('Error placing order:', error);
      showMessage(`Error placing order: ${error.message}`, 'error');
    }
  });

  async function fetchOrders() {
    orderListDiv.innerHTML = '<p>Loading orders...</p>';
    try {
      const response = await fetch(`${ORDER_BASE}/orders/`);
      if (!response.ok) {
        let detail = `HTTP error! status: ${response.status}`;
        try { detail = (await response.json()).detail || detail; } catch {}
        throw new Error(detail);
      }
      const orders = await response.json();

      orderListDiv.innerHTML = '';
      if (!orders.length) {
        orderListDiv.innerHTML = '<p>No orders available yet.</p>';
        return;
      }

      orders.forEach(order => {
        const card = document.createElement('div');
        card.className = 'order-card';
        card.innerHTML = `
          <h3>Order ID: ${order.order_id}</h3>
          <p>User ID: ${order.user_id}</p>
          <p>Order Date: ${new Date(order.order_date).toLocaleString()}</p>
          <p>Status: <span id="order-status-${order.order_id}">${order.status}</span></p>
          <p>Total Amount: ${formatCurrency(order.total_amount)}</p>
          <p>Shipping Address: ${order.shipping_address || 'N/A'}</p>
          <p><small>Created: ${new Date(order.created_at).toLocaleString()}</small></p>
          <p><small>Last Updated: ${order.updated_at ? new Date(order.updated_at).toLocaleString() : '—'}</small></p>

          <h4>Items:</h4>
          <ul class="order-items">
            ${order.items.map(item => `
              <li>
                <span>Product ID: ${item.product_id}</span> - Qty: ${item.quantity} @ ${formatCurrency(item.price_at_purchase)} (Total: ${formatCurrency(item.item_total)})
              </li>
            `).join('')}
          </ul>

          <div class="status-selector">
            <select id="status-select-${order.order_id}" data-order-id="${order.order_id}">
              <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>Processing</option>
              <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
              <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
              <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
              <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Completed</option>
            </select>
            <button class="status-update-btn" data-id="${order.order_id}">Update Status</button>
          </div>
          <div class="card-actions">
            <button class="delete-btn" data-id="${order.order_id}">Delete Order</button>
          </div>
        `;
        orderListDiv.appendChild(card);
      });
    } catch (error) {
      console.error('Error fetching orders:', error);
      showMessage(`Failed to load orders: ${error.message}`, 'error');
      orderListDiv.innerHTML = '<p>Could not load orders. Please check the Order Service.</p>';
    }
  }

  orderListDiv.addEventListener('click', async (event) => {
    if (event.target.classList.contains('status-update-btn')) {
      const orderId = event.target.dataset.id;
      const newStatus = document.getElementById(`status-select-${orderId}`).value;

      try {
        showMessage(`Updating status for order ${orderId} to "${newStatus}"...`, 'info');
        const response = await fetch(`${ORDER_BASE}/orders/${orderId}/status?new_status=${encodeURIComponent(newStatus)}`, { method: 'PATCH' });

        if (!response.ok) {
          let detail = `HTTP error! status: ${response.status}`;
          try { detail = (await response.json()).detail || detail; } catch {}
          throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
        }

        const updated = await response.json();
        document.getElementById(`order-status-${orderId}`).textContent = updated.status;
        showMessage(`Order ${orderId} status updated to "${updated.status}"!`, 'success');
        fetchOrders();
      } catch (error) {
        console.error('Error updating order status:', error);
        showMessage(`Error updating order status: ${error.message}`, 'error');
      }
    }

    if (event.target.classList.contains('delete-btn')) {
      const orderId = event.target.dataset.id;
      if (!confirm(`Delete order ID: ${orderId}? This will also delete all associated items.`)) return;

      try {
        const response = await fetch(`${ORDER_BASE}/orders/${orderId}`, { method: 'DELETE' });
        if (response.status === 204) {
          showMessage(`Order ID: ${orderId} deleted.`, 'success');
          fetchOrders();
        } else {
          let detail = `HTTP error! status: ${response.status}`;
          try { detail = (await response.json()).detail || detail; } catch {}
          throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
        }
      } catch (error) {
        console.error('Error deleting order:', error);
        showMessage(`Error deleting order: ${error.message}`, 'error');
      }
    }
  });

  // Initial loads
  fetchProducts();
  fetchOrders();
});