import type { Schema, Struct } from '@strapi/strapi';

export interface HomeStep extends Struct.ComponentSchema {
  collectionName: 'components_home_step';
  info: {
    displayName: 'Combination step';
    icon: 'key';
  };
  attributes: {
    body: Schema.Attribute.Text & Schema.Attribute.Required;
    label: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface OrderAddress extends Struct.ComponentSchema {
  collectionName: 'components_order_address';
  info: {
    displayName: 'Address';
    icon: 'pin';
  };
  attributes: {
    address1: Schema.Attribute.String & Schema.Attribute.Required;
    address2: Schema.Attribute.String;
    city: Schema.Attribute.String & Schema.Attribute.Required;
    company: Schema.Attribute.String;
    country: Schema.Attribute.String & Schema.Attribute.DefaultTo<'Sri Lanka'>;
    district: Schema.Attribute.String;
    email: Schema.Attribute.String;
    firstName: Schema.Attribute.String & Schema.Attribute.Required;
    lastName: Schema.Attribute.String;
    phone: Schema.Attribute.String;
    postcode: Schema.Attribute.String;
  };
}

export interface OrderLineItem extends Struct.ComponentSchema {
  collectionName: 'components_order_line_item';
  info: {
    displayName: 'Line item';
    icon: 'shopping-cart';
  };
  attributes: {
    image: Schema.Attribute.String;
    lineTotal: Schema.Attribute.Decimal & Schema.Attribute.Required;
    product: Schema.Attribute.Relation<'oneToOne', 'api::product.product'>;
    productId: Schema.Attribute.String;
    productName: Schema.Attribute.String & Schema.Attribute.Required;
    quantity: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    sku: Schema.Attribute.String;
    unitPrice: Schema.Attribute.Decimal & Schema.Attribute.Required;
    variant: Schema.Attribute.String;
  };
}

export interface OrderStatusEntry extends Struct.ComponentSchema {
  collectionName: 'components_order_status_entry';
  info: {
    displayName: 'Status history entry';
    icon: 'clock';
  };
  attributes: {
    at: Schema.Attribute.DateTime;
    by: Schema.Attribute.String;
    note: Schema.Attribute.Text;
    status: Schema.Attribute.String;
  };
}

export interface ProductVariant extends Struct.ComponentSchema {
  collectionName: 'components_product_variant';
  info: {
    displayName: 'Variant';
    icon: 'shopping-cart';
  };
  attributes: {
    label: Schema.Attribute.String & Schema.Attribute.Required;
    price: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    salePrice: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    sku: Schema.Attribute.String;
    stock: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
  };
}

export interface SharedSeo extends Struct.ComponentSchema {
  collectionName: 'components_shared_seo';
  info: {
    displayName: 'SEO';
    icon: 'search';
  };
  attributes: {
    metaDescription: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 170;
      }>;
    metaTitle: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 70;
      }>;
    shareImage: Schema.Attribute.Media<'images'>;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'home.step': HomeStep;
      'order.address': OrderAddress;
      'order.line-item': OrderLineItem;
      'order.status-entry': OrderStatusEntry;
      'product.variant': ProductVariant;
      'shared.seo': SharedSeo;
    }
  }
}
