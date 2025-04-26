import { useCallback, useState } from "react";

import { appFetch } from "../utils/api";
import { LoadingI, ProductI, StateUpdateType } from "../utils/types";
import { generateKeyValuePair } from "../utils/feUtils";

const endpoint = "product/";

type ProductLoadingType = "products" | "addProduct" | "updateProduct" | "product" | "removeProductImage" | null;
type ProductState = {
  data: Record<string, ProductI>;
  nextPage: string | null;
  count: number;
};

export interface ProductFormInterface {
  title: string;
  description: string;
  image: File[];
  price: string;
  discount: string;
  quantity: string;
  categories: string[] | string;
  slideColors: Record<string, string>[] | string;
  sizes: string[]; // NEW: Sizes
  keyFeatures: string[]; // NEW: Key Features
  careInstructions: string; // NEW: Care Instructions
  specifications: { label: string; value: string }[]; // NEW: Specifications
}

interface UseProduct {
  loading: LoadingI<ProductLoadingType>;
  products: ProductState;
  productInfo: ProductI | null;
  addProduct: (data: ProductFormInterface) => Promise<any>;
  updateProduct: (data: Partial<ProductFormInterface>, productId: string) => Promise<any>;
  updateProductState: (type: StateUpdateType, data: ProductI) => void;
  getProducts: (query?: string, nextPage?: string) => Promise<any>;
  getProductDetail: (productId: string) => Promise<any>;
  deleteProductImage: (imageId: string) => Promise<any>;
  filterProductForm: (data: ProductFormInterface, selectedProduct: ProductI) => Partial<ProductFormInterface>;
  resetProductInfo: () => void;
}

function useProduct(): UseProduct {
  const [productInfo, setProductInfo] = useState<ProductI | null>(null);
  const [products, setProducts] = useState<ProductState>({ data: {}, nextPage: null, count: 0 });
  const [loading, setLoading] = useState<LoadingI<ProductLoadingType>>({ type: "products", isLoading: false });

  const startLoading = (type: ProductLoadingType) => setLoading({ type, isLoading: true });
  const stopLoading = () => setLoading({ type: null, isLoading: false });

  const addProduct = useCallback(async (data: ProductFormInterface) => {
    startLoading("addProduct");
  
    // Create a shallow copy of the data to avoid modifying the original
    const formData = { ...data };
    
    // Make sure the arrays are properly formatted before stringifying
    // This ensures we're not double-stringifying arrays that might already be strings
    const sizes = Array.isArray(formData.sizes) ? formData.sizes : (formData.sizes || []);
    const keyFeatures = Array.isArray(formData.keyFeatures) ? formData.keyFeatures : (formData.keyFeatures || []);
    const specifications = Array.isArray(formData.specifications) ? formData.specifications : (formData.specifications || []);
    
    // For FormData we don't want to modify the original values
    // but create a separate serialized version for the API call
    const requestData: any = {
      ...formData,
      categories: JSON.stringify(formData.categories),
      slideColors: JSON.stringify(formData.slideColors),
      sizes: JSON.stringify(sizes),
      keyFeatures: JSON.stringify(keyFeatures),
      specifications: JSON.stringify(specifications)
    };
  
    console.log("this is the product data before submission", requestData);
  
    const response = await appFetch(endpoint, {
      method: "POST",
      body: requestData,
      isFormData: true,
    });
  
    stopLoading();
  
    return response;
  }, []);

  const filterProductForm = useCallback((data: ProductFormInterface, selectedProduct: ProductI) => {
    const formValues = { ...data } as Partial<ProductFormInterface>;
  
    for (const key in formValues) {
      const currentValue = formValues[key as keyof ProductFormInterface];
      const oldValue = selectedProduct[key as keyof ProductI];
      
      // Skip our standard exclusions
      if (!["categories", "image"].includes(key) && currentValue == oldValue) {
        delete formValues[key as keyof ProductFormInterface];
      }
  
      // Handle arrays and objects specially
      if (key === "image" && !formValues.image) delete formValues.image;
      
      if (key === "categories" && formValues.categories?.length) {
        if (Array.isArray(formValues.categories) && selectedProduct.categoryIds.length === formValues.categories?.length) {
          const isChanged = formValues.categories.some((categoryId) => !selectedProduct.categoryIds.includes(categoryId));
          if (!isChanged) {
            delete formValues.categories;
          }
        }
      }
      
      // Add special handling for sizes array
      if (key === "sizes" && Array.isArray(formValues.sizes) && Array.isArray(selectedProduct.sizes)) {
        if (formValues.sizes.length === selectedProduct.sizes.length) {
          const isChanged = formValues.sizes.some((size) => !selectedProduct.sizes.includes(size));
          if (!isChanged) {
            delete formValues.sizes;
          }
        }
      }
      
      // Add special handling for keyFeatures array
      if (key === "keyFeatures" && Array.isArray(formValues.keyFeatures) && Array.isArray(selectedProduct.keyFeatures)) {
        if (formValues.keyFeatures.length === selectedProduct.keyFeatures.length) {
          const isChanged = formValues.keyFeatures.some((feature) => !selectedProduct.keyFeatures.includes(feature));
          if (!isChanged) {
            delete formValues.keyFeatures;
          }
        }
      }
      
      // Add special handling for specifications which is an array of objects
      if (key === "specifications" && Array.isArray(formValues.specifications) && Array.isArray(selectedProduct.specifications)) {
        if (formValues.specifications.length === selectedProduct.specifications.length) {
          // Compare by converting to JSON and back for deep comparison
          const oldSpecsJson = JSON.stringify(selectedProduct.specifications);
          const newSpecsJson = JSON.stringify(formValues.specifications);
          if (oldSpecsJson === newSpecsJson) {
            delete formValues.specifications;
          }
        }
      }
    }
  
    return formValues;
  }, []);

  const updateProduct = useCallback(async (data: Partial<ProductFormInterface>, productId: string) => {
    startLoading("updateProduct");
  
    // Create a shallow copy for the request
    const requestData: any = { ...data };
  
    // Stringify arrays and objects for API transmission
    if (data.categories) {
      requestData.categories = JSON.stringify(data.categories);
    }
  
    if (data.slideColors) {
      requestData.slideColors = JSON.stringify(data.slideColors);
    }
  
    if (data.sizes) {
      requestData.sizes = JSON.stringify(data.sizes);
    }
  
    if (data.keyFeatures) {
      requestData.keyFeatures = JSON.stringify(data.keyFeatures);
    }
  
    if (data.specifications) {
      requestData.specifications = JSON.stringify(data.specifications);
    }
  
    const response = await appFetch(`${endpoint}${productId}/`, {
      method: "PATCH",
      body: requestData,
      isFormData: true,
    });
  
    stopLoading();
  
    return response;
  }, []);

  const updateProductState = useCallback((type: StateUpdateType, data: ProductI) => {
    setProducts((prev) => ({
      ...prev,
      data: { ...prev.data, [data.id]: data },
    }));

    if (type === "update") {
      setProductInfo(data);
    }
  }, []);

// In useProduct.ts
const getProducts = useCallback(async (query = "", nextPage?: string) => {
  try {
    startLoading("products");

    const url = nextPage ? nextPage : `products/${query}`;
    
    console.log("🔹 Fetching Products from:", url);

    const response = await appFetch(url, {
      method: "GET",
      disableUrlAppend: !!nextPage,
    });

    console.log("✅ Product API Response:", response);

    // ✅ Fix: Properly check for success status
    if (!response || (response.status !== 200 && response.status !== "200")) {
      console.error("❌ Failed to fetch products:", response?.message || "Unknown errors");
      stopLoading();
      return;
    }

    // ✅ Update state if data is valid
    if (response.data) {
      const products = generateKeyValuePair<ProductI>(response.data);
      setProducts((prev) => ({
        data: { ...prev.data, ...products },
        nextPage: response.next || null,
        count: response.count || 0,
      }));
    }
  } catch (error) {
    console.error("❌ Error in getProducts:", error);
  } finally {
    stopLoading();
  }
}, []);


  const getProductDetail = useCallback(async (productId: string) => {
    startLoading("product");
    const response = await appFetch(`${endpoint}${productId}/`, {
      method: "GET",
    });
    stopLoading();
    if (response.data) {
      setProductInfo(response.data);
    }
  }, []);

  const resetProductInfo = useCallback(() => {
    setProductInfo(null);
  }, []);

  const deleteProductImage = useCallback(
    async (imageId) => {
      if (imageId && productInfo?.id) {
        startLoading("removeProductImage");
        const response = await appFetch(`${endpoint}image/${imageId}/`, {
          method: "DELETE",
          body: JSON.stringify({ productId: productInfo?.id }),
          headers: {
            "Content-Type": "application/json",
          },
        });
        stopLoading();
        if (response.data) {
          setProductInfo(response.data);
        }
      }
    },
    [productInfo],
  );

  return {
    addProduct,
    updateProduct,
    updateProductState,
    getProducts,
    getProductDetail,
    filterProductForm,
    resetProductInfo,
    deleteProductImage,
    productInfo,
    products,
    loading,
  };
}

export default useProduct;
