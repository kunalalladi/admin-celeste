import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import Button from "../Button";
import { Input, Select, ImagePicker, Message, MessageI, SelectOption } from "../Form";
import SideModal, { SideModalI } from "./SideModal";

import { useProduct, useCategory, ProductFormInterface } from "../../hooks";
import { Option, PreviewImage, ProductI, StateUpdateType } from "../../utils/types";
import { fillEmptySlotsWithDefault, showToast } from "../../utils/feUtils";

const defaultSlideColor = { backgroundColor: "#FFFFFF", color: "#222222" };

interface AddproductModal extends SideModalI {
  selectedProduct?: ProductI | null;
  updateProductState: (type: StateUpdateType, data: ProductI) => void;
  onProductImageDelete: (imageId: string) => void;
}

const AddProductModal: React.FC<AddproductModal> = ({ visible, onClose, selectedProduct, updateProductState, onProductImageDelete }) => {
  const { getCategories } = useCategory();
  const { addProduct, loading, filterProductForm, updateProduct } = useProduct();


  const [uploadedImages, setUploadedImages] = useState<Record<string, PreviewImage>>({});
  const [categories, setCategories] = useState<Option[]>([]);

  const [sizes, setSizes] = useState<string[]>([]);
  const [keyFeatures, setKeyFeatures] = useState<string[]>([]);
  const [specifications, setSpecifications] = useState<Array<{ label: string; value: string }>>([]);
  const [newSize, setNewSize] = useState<string>("");
  const [newKeyFeature, setNewKeyFeature] = useState<string>("");
  const [newSpecLabel, setNewSpecLabel] = useState<string>("");
  const [newSpecValue, setNewSpecValue] = useState<string>("");

  const selectedImageColors = React.useRef<Record<string, string>[]>([]);

  const {
    reset,
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors },
  } = useForm<ProductFormInterface>();

  const onSubmit = async (data: ProductFormInterface) => {
    // Add the sizes, keyFeatures, careInstructions, and specifications to the form data
    data.sizes = sizes;
    data.keyFeatures = keyFeatures;
    data.specifications = specifications;
    function handleResponse(response: any) {
      if (response.status == 200) {
        onClose();
        if (!selectedProduct) reset();
        selectedImageColors.current = [];
        updateProductState(selectedProduct ? "update" : "add", response.data);
        const message = selectedProduct ? "Product details updated." : "Product added successfully.";
        showToast(message, "success");
      } else {
        response?.errors?.map((error: { key: keyof ProductFormInterface; message: string }) =>
          setError(error.key, { message: error.message }),
        );
      }
    }

    if (selectedProduct) {
      const formValues = filterProductForm(data, selectedProduct);

      if (selectedImageColors.current?.length) {
        const updatedSlideColors = fillEmptySlotsWithDefault(
          selectedImageColors.current,
          selectedProduct.slideColors?.length ? null : defaultSlideColor,
        );

        formValues.slideColors = new Array((formValues.image?.length || 0) + selectedProduct.images.length)
          .fill(defaultSlideColor)
          .map((slideColor, index) => {
            const previousSavedColors = selectedProduct.slideColors?.[index];
            const isColorPreSelected = previousSavedColors?.backgroundColor && previousSavedColors?.color;

            if (updatedSlideColors[index]) {
              return updatedSlideColors[index];
            }

            if (isColorPreSelected) {
              return selectedProduct.slideColors[index];
            }

            return slideColor;
          });
      }

      if (Object.keys(formValues).length) {
        const response = await updateProduct(formValues, selectedProduct.id);
        handleResponse(response);
      } else {
        onClose();
      }
    } else {
      data.slideColors = fillEmptySlotsWithDefault(selectedImageColors.current, {
        backgroundColor: "#FFFFFF",
        color: "#222222",
      });
      const response = await addProduct(data);
      handleResponse(response);
    }
  };

  const removeProductImage = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    const imageId = e.currentTarget.dataset.image;
    if (imageId) {
      setUploadedImages((images) => ({
        ...images,
        [imageId]: { ...images[imageId], isLoading: true },
      }));
      await onProductImageDelete(imageId);
      setUploadedImages((images) => ({
        ...images,
        [imageId]: { ...images[imageId], isLoading: false },
      }));
    }
  };

  const updateImageColor = ({ target: { name, dataset, value } }: React.ChangeEvent<HTMLInputElement>) => {
    const index = dataset.index ? parseInt(dataset.index) : 0;
    const colors = selectedImageColors.current;
    if (colors[index]) {
      colors[index][name] = value;
    } else {
      colors[index] = {
        backgroundColor: "#FFFFFF",
        color: "#222222",
      };
      colors[index][name] = value;
    }
  };

  // For the sizes field, modify your handleAddSize function:
  const handleAddSize = () => {
    if (newSize.trim() && !sizes.includes(newSize.trim())) {
      const updatedSizes = [...sizes, newSize.trim()];
      setSizes(updatedSizes);
      setValue('sizes', updatedSizes); // Update the form value
      setNewSize("");
    }
  };

  // Similarly for handleRemoveSize:
  const handleRemoveSize = (sizeToRemove: string) => {
    const updatedSizes = sizes.filter(size => size !== sizeToRemove);
    setSizes(updatedSizes);
    setValue('sizes', updatedSizes); // Update the form value
  };

  // Do the same for keyFeatures:
  const handleAddKeyFeature = () => {
    if (newKeyFeature.trim() && !keyFeatures.includes(newKeyFeature.trim())) {
      const updatedFeatures = [...keyFeatures, newKeyFeature.trim()];
      setKeyFeatures(updatedFeatures);
      setValue('keyFeatures', updatedFeatures); // Update the form value
      setNewKeyFeature("");
    }
  };

  const handleRemoveKeyFeature = (featureToRemove: string) => {
    const updatedFeatures = keyFeatures.filter(feature => feature !== featureToRemove);
    setKeyFeatures(updatedFeatures);
    setValue('keyFeatures', updatedFeatures); // Update the form value
  };

  // And for specifications:
  const handleAddSpecification = () => {
    if (newSpecLabel.trim() && newSpecValue.trim()) {
      const updatedSpecs = [...specifications, { label: newSpecLabel.trim(), value: newSpecValue.trim() }];
      setSpecifications(updatedSpecs);
      setValue('specifications', updatedSpecs); // Update the form value
      setNewSpecLabel("");
      setNewSpecValue("");
    }
  };

  const handleRemoveSpecification = (index: number) => {
    const updatedSpecs = specifications.filter((_, i) => i !== index);
    setSpecifications(updatedSpecs);
    setValue('specifications', updatedSpecs); // Update the form value
  };
  


  // ⚠️  categories.length is a check to call api only once during the component lifecycle it will stop
  // running the code block if categories already fetched if we remove the check it will
  // be infinite call and may need to pick different approach
  useEffect(() => {
    if (categories.length === 0 && visible) {
      (async () => {
        const categories = await getCategories(false);
        setCategories(
          categories.map((category) => ({
            label: category.name,
            value: category.id,
            isSelected: selectedProduct?.categoryIds ? selectedProduct.categoryIds.includes(category.id) : false,
          })),
        );
      })();
    }
  }, [visible, categories, getCategories, selectedProduct?.categoryIds]);

  useEffect(() => {
    if (selectedProduct && visible) {
      setValue("title", selectedProduct.title);
      setValue("price", `${selectedProduct.price}`);
      setValue("discount", `${selectedProduct.discount}`);
      setValue("quantity", `${selectedProduct.quantity}`);
      setValue("description", selectedProduct.description || "");
      setValue("categories", selectedProduct.categoryIds);
      setValue("careInstructions", selectedProduct.careInstructions || "");
      
      // Set the state for arrays
      setSizes(selectedProduct.sizes || []);
      setKeyFeatures(selectedProduct.keyFeatures || []);
      setSpecifications(selectedProduct.specifications || []);

      const images = selectedProduct.images.reduce(
        (previous, image, index) => ({
          ...previous,
          [image.fileId]: {
            id: image.fileId,
            url: image.url,
            ...selectedProduct.slideColors[index],
          },
        }),
        {} as Record<string, PreviewImage>,
      );

      setUploadedImages(images);
    }
  }, [selectedProduct, setValue, visible]);

  useEffect(() => {
    if (!visible) {
      reset();
      setUploadedImages({});
      selectedImageColors.current = [];
      setSizes([]);
      setKeyFeatures([]);
      setSpecifications([]);
      setNewSize("");
      setNewKeyFeature("");
      setNewSpecLabel("");
      setNewSpecValue("");
    }
  }, [reset, visible]);

  return (
    <SideModal visible={visible} onClose={onClose}>
      <div>
        <h2 className="ff-lato font-black text-2xl">{selectedProduct !== null ? "Edit" : "Add"} Product</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-10">
          <div>
            <Controller
              name="title"
              control={control}
              defaultValue=""
              rules={{ required: "Please enter product title." }}
              render={({ field }) => {
                const additionalInputProps = {} as MessageI;

                if (errors.title?.message) {
                  additionalInputProps.messageType = "error";
                  additionalInputProps.message = errors.title.message;
                }
                return <Input type="text" label="Title" {...field} {...additionalInputProps} />;
              }}
            />

            <div className="flex justify-between">
              <Controller
                name="price"
                control={control}
                defaultValue={""}
                rules={{
                  pattern: {
                    value: /^\d*(\.\d{0,2})?$/,
                    message: "Please enter valid price. More than 2 decimal places are not allowed.",
                  },
                  required: "Please enter price.",
                }}
                render={({ field }) => {
                  const additionalInputProps = {} as MessageI;

                  if (errors.price?.message) {
                    additionalInputProps.messageType = "error";
                    additionalInputProps.message = errors.price.message;
                  }
                  return (
                    <Input
                      type="number"
                      label="Price (After Discount)"
                      icon="price"
                      className="basis-30"
                      {...field}
                      {...additionalInputProps}
                    />
                  );
                }}
              />

              <Controller
                name="discount"
                control={control}
                defaultValue={""}
                rules={{
                  validate: (value) => parseInt(value) <= 100 || !value || "Please enter valid discount.",
                }}
                render={({ field }) => {
                  const additionalInputProps = {} as MessageI;

                  if (errors.discount?.message) {
                    additionalInputProps.messageType = "error";
                    additionalInputProps.message = errors.discount.message;
                  }
                  return <Input type="number" icon="discount" label="Discount" className="basis-30" {...field} {...additionalInputProps} />;
                }}
              />

              <Controller
                name="quantity"
                control={control}
                defaultValue={""}
                rules={{
                  required: "Please enter quantity.",
                  validate: (value) => parseFloat(value) % 1 === 0 || "Please enter valid integer.",
                }}
                render={({ field }) => {
                  const additionalInputProps = {} as MessageI;

                  if (errors.quantity?.message) {
                    additionalInputProps.messageType = "error";
                    additionalInputProps.message = errors.quantity.message;
                  }
                  return <Input type="number" label="Quantity" className="basis-30" {...field} {...additionalInputProps} />;
                }}
              />
            </div>

            




            <Controller
              name="description"
              control={control}
              defaultValue=""
              rules={{ required: "Please enter product description." }}
              render={({ field }) => {
                const additionalInputProps = {} as MessageI;

                if (errors.description?.message) {
                  additionalInputProps.messageType = "error";
                  additionalInputProps.message = errors.description.message;
                }
                return (
                  <Input type="textarea" label="Description" className="basis-30" maxLength={300} {...field} {...additionalInputProps} />
                );
              }}
            />

            {/* Care Instructions Field */}
            <Controller
              name="careInstructions"
              control={control}
              defaultValue=""
              render={({ field }) => {
                const additionalInputProps = {} as MessageI;

                if (errors.careInstructions?.message) {
                  additionalInputProps.messageType = "error";
                  additionalInputProps.message = errors.careInstructions.message;
                }
                return (
                  <Input type="textarea" label="Care Instructions" className="basis-30" maxLength={300} {...field} {...additionalInputProps} />
                );
              }}
            />

            {/* Sizes Field */}
            <Controller
              name="sizes"
              control={control}
              defaultValue={sizes}
              rules={{ required: "Please add at least one size." }}
              render={({ field }) => {
                const additionalInputProps = {} as MessageI;

                if (errors.sizes?.message) {
                  additionalInputProps.messageType = "error";
                  additionalInputProps.message = errors.sizes.message;
                }
                
                return (
                  <div className="w-full mb-3.5">
                    <label className="ff-lato text-xs font-extrabold inline-block mb-1">Sizes</label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        type="text"
                        placeholder="Enter size"
                        value={newSize}
                        onChange={(e) => setNewSize(e.target.value)}
                        className="basis-5/6 mb-0"
                        {...additionalInputProps}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-12 basis-1/6"
                        onClick={handleAddSize}
                      >
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {sizes.map((size, index) => (
                        <div key={index} className="bg-lightGray rounded-full px-3 py-1 flex items-center gap-1">
                          <span>{size}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSize(size)}
                            className="text-danger rounded-full w-4 h-4 flex items-center justify-center"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    {errors.sizes && <Message messageType="error" message={errors.sizes.message || ""} />}
                  </div>
                );
              }}
            />

            {/* Key Features Field */}
            <Controller
              name="keyFeatures"
              control={control}
              defaultValue={keyFeatures}
              rules={{ required: "Please add at least one key feature." }}
              render={({ field }) => {
                const additionalInputProps = {} as MessageI;

                if (errors.keyFeatures?.message) {
                  additionalInputProps.messageType = "error";
                  additionalInputProps.message = errors.keyFeatures.message;
                }
                
                return (
                  <div className="w-full mb-3.5">
                    <label className="ff-lato text-xs font-extrabold inline-block mb-1">Key Features</label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        type="text"
                        placeholder="Enter key feature"
                        value={newKeyFeature}
                        onChange={(e) => setNewKeyFeature(e.target.value)}
                        className="basis-5/6 mb-0"
                        {...additionalInputProps}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-12 basis-1/6"
                        onClick={handleAddKeyFeature}
                      >
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-col gap-2 mt-2">
                      {keyFeatures.map((feature, index) => (
                        <div key={index} className="bg-lightGray rounded-lg px-3 py-2 flex items-center justify-between">
                          <span>{feature}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveKeyFeature(feature)}
                            className="text-danger rounded-full w-6 h-6 flex items-center justify-center"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    {errors.keyFeatures && <Message messageType="error" message={errors.keyFeatures.message || ""} />}
                  </div>
                );
              }}
            />

            {/* Specifications Field */}
            <Controller
              name="specifications"
              control={control}
              defaultValue={specifications}
              rules={{ required: "Please add at least one specification." }}
              render={({ field }) => {
                const additionalInputProps = {} as MessageI;

                if (errors.specifications?.message) {
                  additionalInputProps.messageType = "error";
                  additionalInputProps.message = errors.specifications.message;
                }
                
                return (
                  <div className="w-full mb-3.5">
                    <label className="ff-lato text-xs font-extrabold inline-block mb-1">Specifications</label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        type="text"
                        placeholder="Label (e.g. Material)"
                        value={newSpecLabel}
                        onChange={(e) => setNewSpecLabel(e.target.value)}
                        className="basis-2/5 mb-0"
                        {...additionalInputProps}
                      />
                      <Input
                        type="text"
                        placeholder="Value (e.g. Cotton)"
                        value={newSpecValue}
                        onChange={(e) => setNewSpecValue(e.target.value)}
                        className="basis-2/5 mb-0"
                        {...additionalInputProps}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-12 basis-1/5"
                        onClick={handleAddSpecification}
                      >
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-col gap-2 mt-2">
                      {specifications.map((spec, index) => (
                        <div key={index} className="bg-lightGray rounded-lg px-3 py-2 flex items-center justify-between">
                          <div>
                            <span className="font-bold">{spec.label}:</span> {spec.value}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveSpecification(index)}
                            className="text-danger rounded-full w-6 h-6 flex items-center justify-center"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    {errors.specifications && <Message messageType="error" message={errors.specifications.message || ""} />}
                  </div>
                );
              }}
            />


            
            <Controller
              name="categories"
              control={control}
              rules={{ required: "Please select atleast one category." }}
              render={({ field: { onChange, value } }) => (
                <>
                  <Select
                    items={categories}
                    label="Categories"
                    placeholder={value?.length ? `${value.length} item${value.length > 1 ? "s" : ""} selected.` : "Select Categories"}
                    onChange={onChange}
                    isSingle={false}
                    className={"mb-1"}
                  >
                    {categories.map((category, index) => {
                      const isSelected = value?.includes(category.value);
                      return (
                        <SelectOption key={category.value} isSelectedItem={isSelected} item={category} index={index}>
                          {category.label}
                        </SelectOption>
                      );
                    })}
                  </Select>
                  {errors.categories && errors.categories.type === "required" && (
                    <Message messageType="error" message={errors.categories.message || ""} />
                  )}
                </>
              )}
            />

            <Controller
              name="image"
              control={control}
              rules={{
                validate: {
                  required: (value) => {
                    if (!value && !selectedProduct) return "Please upload atleast one image.";
                    return true;
                  },
                },
              }}
              render={({ field: { onChange, value } }) => (
                <>
                  <ImagePicker
                    label="Upload Image"
                    actionText="Upload Image"
                    previousUploadUrls={uploadedImages}
                    resetComponentState={!visible}
                    maxUpload={3}
                    className={"mb-2 mt-10"}
                    onImageRemove={removeProductImage}
                    onColorChange={updateImageColor}
                    onChange={onChange}
                  />
                  {errors.image && errors.image.type === "required" && <Message messageType="error" message={errors.image.message || ""} />}
                </>
              )}
            />
          </div>
          <Button
            variant="primary"
            type="submit"
            isLoading={(loading.type === "addProduct" || loading.type === "updateProduct") && loading.isLoading}
            className="my-10"
          >
            {selectedProduct !== null ? "Update" : "Add"} Product
          </Button>
        </form>
      </div>
    </SideModal>
  );
};

export default AddProductModal;
