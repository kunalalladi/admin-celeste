import React from "react";
import Image from "next/image";
import { EditOutlined } from "@mui/icons-material";

import Button from "../Button";
import Chip from "../Chip";
import SideModal, { SideModalI } from "./SideModal";

import { ProductI } from "../../utils/types";

interface ProductDetailModalI extends SideModalI {
  selectedProduct: ProductI | null;
  onProductEdit: () => void;
}

const ProductDetailModal: React.FC<ProductDetailModalI> = ({ visible, selectedProduct, onClose, onProductEdit }) => (
  <SideModal visible={visible} onClose={onClose}>
    <div className="overflow-y-auto pr-2">
      <div className="flex flex-row justify-between items-center">
        <div>
          <h2 className="ff-lato font-black text-2xl">{selectedProduct?.title}</h2>
          <div className="mt-2">
            {selectedProduct?.category.map((category) => (
              <Chip key={category.id} text={category.name} />
            ))}
          </div>
        </div>
        <div className="w-10 h-10">
          <Button variant="primary" type="button" style={{ height: "100%", padding: 0 }} onClick={onProductEdit} className="rounded-xl">
            <EditOutlined />
          </Button>
        </div>
      </div>
      
      {/* Product Images Gallery */}
      <div className="flex mt-5 py-2 overflow-x-auto">
        {selectedProduct?.images.map((image, index) => {
          const imageUrl = typeof image === "string" ? image : image.url;
          const isBackgroundColor = selectedProduct.slideColors[index]?.backgroundColor;

          return (
            <div
              key={`${imageUrl}-${index}`}
              className="w-32 h-32 rounded-xl overflow-hidden bg-white mr-3.5 flex-shrink-0 flex justify-center items-center border border-gray/50 hover:shadow-2xl ease-in duration-300"
              style={isBackgroundColor ? { backgroundColor: selectedProduct.slideColors[index]?.backgroundColor } : {}}
            >
              {imageUrl && (
                <Image src={imageUrl} width={100} height={100} objectFit="contain" alt="Product image" />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Price, Discount and Quantity */}
      <div className="flex justify-between items-center mt-5">
        <p>
          <span className="text-2xl text-success font-extrabold">${selectedProduct?.price}</span>
          <span className="text-medium text-lg text-gray ml-2">({selectedProduct?.quantity} units available)</span>
        </p>
        <div>{selectedProduct?.discount && <Chip variant="success" text={`${selectedProduct.discount}% OFF`} />}</div>
      </div>
      
      {/* Description */}
      <div className="mt-6">
        <h3 className="text-lg font-bold text-darkBlack mb-2">Description</h3>
        <p className="text-lightBlack font-medium text-base">{selectedProduct?.description}</p>
      </div>
      
      {/* Available Sizes */}
      {selectedProduct?.sizes && selectedProduct.sizes.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-bold text-darkBlack mb-2">Available Sizes</h3>
          <div className="flex flex-wrap gap-2">
            {selectedProduct.sizes.map((size, index) => (
              <Chip key={`size-${index}`} text={size} variant="outlined" />
            ))}
          </div>
        </div>
      )}
      
      {/* Key Features */}
      {selectedProduct?.keyFeatures && selectedProduct.keyFeatures.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-bold text-darkBlack mb-2">Key Features</h3>
          <ul className="list-disc pl-5">
            {selectedProduct.keyFeatures.map((feature, index) => (
              <li key={`feature-${index}`} className="text-lightBlack mb-1">{feature}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Care Instructions */}
      {selectedProduct?.careInstructions && (
        <div className="mt-6">
          <h3 className="text-lg font-bold text-darkBlack mb-2">Care Instructions</h3>
          <p className="text-lightBlack font-medium">{selectedProduct.careInstructions}</p>
        </div>
      )}
      
      {/* Specifications */}
      {selectedProduct?.specifications && selectedProduct.specifications.length > 0 && (
        <div className="mt-6 mb-6">
          <h3 className="text-lg font-bold text-darkBlack mb-2">Specifications</h3>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <tbody>
                {selectedProduct.specifications.map((spec, index) => (
                  <tr key={`spec-${index}`} className={index % 2 === 0 ? "bg-gray/10" : ""}>
                    <td className="px-3 py-2 border-b border-gray/20 font-medium w-1/3">{spec.label}</td>
                    <td className="px-3 py-2 border-b border-gray/20">{spec.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Product Status */}
      <div className="mt-6 mb-6 flex gap-3">
        {selectedProduct?.isStaffPick && <Chip variant="info" text="Staff Pick" />}
        {selectedProduct?.isFeatured && <Chip variant="warning" text="Featured" />}
      </div>
    </div>
  </SideModal>
);

export default ProductDetailModal;