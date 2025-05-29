export default async function handler(req, res) {
  // CORS headers - Add your actual domains here
  const allowedOrigins = [
     'https://trqd71-2n.myshopify.com',
    'https://wholesaleworldubai.com/', // Add your custom domain
    'https://www.wholesaleworldubai.com'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    // Get environment variables
    const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
    const SHOP_DOMAIN = process.env.SHOP_DOMAIN || 'trqd71-2n.myshopify.com';
    
    if (!SHOPIFY_TOKEN) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }

    // Validate input
    const { 
      customerName, 
      customerPhone, 
      customerEmirates, 
      deliveryAddress, 
      cartItems,
      subtotal,
      hasFreeShipping = false
    } = req.body;

    if (!customerName || !customerPhone || !customerEmirates || !deliveryAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required customer information'
      });
    }

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cart is empty'
      });
    }

    // Format phone number
    let formattedPhone = customerPhone;
    if (!formattedPhone.startsWith("+")) {
      formattedPhone = "+971" + formattedPhone.replace(/^0+/, '');
    }

    // Split name
    let firstName = customerName;
    let lastName = " ";
    
    if (customerName.includes(" ")) {
      const nameParts = customerName.split(" ");
      firstName = nameParts[0];
      lastName = nameParts.slice(1).join(" ");
    }

    // Calculate VAT
    function calculateVAT(amount) {
      if (amount <= 0) return 0;
      const nextMultipleOf5 = Math.ceil(amount / 5) * 5;
      return nextMultipleOf5 - amount;
    }
    
    const vatAmount = calculateVAT(subtotal);

    // Create address object
    const addressObject = {
      first_name: firstName,
      last_name: lastName,
      name: customerName,
      address1: deliveryAddress,
      phone: formattedPhone,
      city: customerEmirates,
      province: customerEmirates,
      country: "United Arab Emirates",
      country_code: "AE",
      zip: "00000"
    };

    // Create order payload
    const orderData = {
      order: {
        line_items: cartItems,
        phone: formattedPhone,
        customer: {
          first_name: firstName,
          last_name: lastName,
          phone: formattedPhone
        },
        shipping_address: addressObject,
        billing_address: addressObject,
        financial_status: "pending",
        fulfillment_status: "unfulfilled",
        shipping_lines: [{
          price: hasFreeShipping ? "0.00" : "15.00",
          title: hasFreeShipping ? "Free Shipping" : "Cash On Delivery"
        }],
        tax_lines: [{
          price: vatAmount.toFixed(2),
          rate: 0,
          title: "VAT (Round-up)"
        }],
        tags: "mobile-order, custom-checkout" + (hasFreeShipping ? ", free-shipping" : "")
      }
    };

    console.log('Creating order:', JSON.stringify(orderData, null, 2));

    // Make request to Shopify
    const shopifyURL = `https://${SHOP_DOMAIN}/admin/api/2023-10/orders.json`;
    
    const response = await fetch(shopifyURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_TOKEN
      },
      body: JSON.stringify(orderData)
    });

    const result = await response.json();
    console.log('Shopify response:', result);

    if (response.ok && result.order) {
      return res.json({
        success: true,
        order: result.order,
        orderId: result.order.id,
        orderNumber: result.order.order_number
      });
    } else {
      console.error('Shopify API error:', result);
      
      // Try fallback with minimal fields
      const fallbackOrderData = {
        order: {
          line_items: cartItems,
          customer: {
            first_name: firstName,
            last_name: lastName,
            phone: formattedPhone
          },
          shipping_address: {
            first_name: firstName,
            last_name: lastName,
            address1: deliveryAddress,
            city: customerEmirates,
            province: customerEmirates,
            country: "United Arab Emirates",
            country_code: "AE",
            zip: "00000",
            phone: formattedPhone
          },
          shipping_lines: [{
            price: hasFreeShipping ? "0.00" : "15.00",
            title: hasFreeShipping ? "Free Shipping" : "Cash On Delivery"
          }],
          tax_lines: [{
            price: vatAmount.toFixed(2),
            rate: 0,
            title: "VAT (Round-up)"
          }]
        }
      };

      const fallbackResponse = await fetch(shopifyURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": SHOPIFY_TOKEN
        },
        body: JSON.stringify(fallbackOrderData)
      });

      const fallbackResult = await fallbackResponse.json();

      if (fallbackResponse.ok && fallbackResult.order) {
        return res.json({
          success: true,
          order: fallbackResult.order,
          orderId: fallbackResult.order.id,
          orderNumber: fallbackResult.order.order_number
        });
      } else {
        return res.status(400).json({
          success: false,
          error: 'Failed to create order',
          details: fallbackResult.errors || result.errors
        });
      }
    }

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
