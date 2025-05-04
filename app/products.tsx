import { Ionicons } from "@expo/vector-icons";
import { isAxiosError } from "axios";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { COLORS } from "../constants/colors";
import api from "../libs/api";
import { useAuthStore } from "../stores/auth";
import { useCartStore } from "../stores/cart";
import { usePaymentStore } from "../stores/payment";

interface ProductResponse {
  id: number;
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  status: "AVAILABLE" | "SOLD_OUT" | "HIDDEN";
  stock: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface CartItemType {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

interface CreateOrderItemRequest {
  productId: number;
  quantity: number;
}

interface CreateOrderRequest {
  items: CreateOrderItemRequest[];
}

const Products = () => {
  const [, setSecretTapCount] = useState(0);
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { logout } = useAuthStore();
  const {
    items: cart,
    addItem,
    updateQuantity,
    clearCart,
    getTotalAmount,
    getTotalItems,
  } = useCartStore();

  const { createPayment } = usePaymentStore();

  const fetchProducts = async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const response = await api.get<ProductResponse[]>("/products/available");
      setProducts(response.data);
      setError(null);
    } catch {
      setError("상품을 불러올 수 없습니다");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchProducts(false);
  };

  const handleSecretTap = () => {
    setSecretTapCount((prev) => {
      const newCount = prev + 1;
      if (newCount >= 7) {
        Alert.alert(
          "키오스크 연결 해제",
          "이 키오스크의 연결을 해제하시겠습니까?",
          [
            {
              text: "취소",
              style: "cancel",
              onPress: () => setSecretTapCount(0),
            },
            {
              text: "연결 해제",
              style: "destructive",
              onPress: () => {
                logout();
                clearCart();
                router.replace("/registration");
              },
            },
          ]
        );
        return 0;
      }
      return newCount;
    });
  };

  const handlePayment = async () => {
    if (cart.length === 0) {
      Toast.show({
        type: "info",
        text1: "상품을 선택해주세요",
      });
      return;
    }

    try {
      const orderRequest: CreateOrderRequest = {
        items: cart.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
        })),
      };

      const response = await api.post("/orders", orderRequest);

      if (response.data?.id) {
        createPayment(response.data.id);
        router.navigate("/payment");
      } else {
        throw new Error("주문 생성 실패");
      }
    } catch (error) {
      let errorMessage = "주문 처리에 실패했습니다";

      if (isAxiosError(error) && error.response) {
        const errorData = error.response.data;

        if (errorData?.code) {
          switch (errorData.code) {
            case "INSUFFICIENT_STOCK":
              errorMessage = "재고가 부족합니다";
              break;
            case "PRODUCT_NOT_FOUND":
              errorMessage = "일부 상품이 판매 불가능합니다";
              break;
            case "PRODUCT_UNAVAILABLE":
              errorMessage = "판매 중단된 상품이 포함되어 있습니다";
              break;
          }
        }
      }

      Toast.show({
        type: "error",
        text1: errorMessage,
      });

      fetchProducts(false);
    }
  };

  const handleAddToCart = (product: ProductResponse) => {
    if (product.status === "SOLD_OUT" || product.stock <= 0) {
      Toast.show({
        type: "info",
        text1: "품절된 상품입니다",
      });
      return;
    }

    const existingItem = cart.find((item) => item.id === product.id);
    const currentQuantity = existingItem ? existingItem.quantity : 0;

    if (currentQuantity >= product.stock) {
      Toast.show({
        type: "info",
        text1: "재고가 부족합니다",
      });
      return;
    }

    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
    });
  };

  const handleQuantityUpdate = (id: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      updateQuantity(id, 0);
      return;
    }

    const product = products.find((p) => p.id === id);
    if (product && newQuantity > product.stock) {
      Toast.show({
        type: "info",
        text1: "재고가 부족합니다",
      });
      return;
    }
    updateQuantity(id, newQuantity);
  };

  const renderProductItem = ({ item }: { item: ProductResponse }) => {
    const isSoldOut = item.status === "SOLD_OUT" || item.stock <= 0;
    const cartItem = cart.find((cartItem) => cartItem.id === item.id);
    const inCart = cartItem !== undefined;

    return (
      <TouchableOpacity
        style={[
          styles.productItem,
          isSoldOut && styles.soldOutItem,
          inCart && styles.inCartItem,
        ]}
        onPress={() => handleAddToCart(item)}
        activeOpacity={0.7}
        disabled={isSoldOut}
      >
        <View style={styles.productImageContainer}>
          <Image
            source={
              item.imageUrl
                ? { uri: item.imageUrl }
                : require("../assets/images/placeholder.png")
            }
            style={styles.productImage}
            resizeMode="cover"
          />
          {isSoldOut && (
            <View style={styles.soldOutOverlay}>
              <Text style={styles.soldOutText}>품절</Text>
            </View>
          )}
          {inCart && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartItem.quantity}</Text>
            </View>
          )}
        </View>
        <View style={styles.productInfo}>
          <Text
            style={styles.productName}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.name}
          </Text>
          <Text style={[styles.productPrice, isSoldOut && styles.soldOutPrice]}>
            {item.price.toLocaleString()}원
          </Text>
          <View style={styles.stockContainer}>
            {!isSoldOut && (
              <Text style={styles.stockText}>재고: {item.stock}개</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCartItem = ({ item }: { item: CartItemType }) => {
    const product = products.find((p) => p.id === item.id);
    const maxReached = product && item.quantity >= product.stock;

    return (
      <View style={styles.cartItem}>
        <TouchableOpacity
          style={styles.cartItemInfo}
          onPress={() => updateQuantity(item.id, 0)}
        >
          <Text
            style={styles.cartItemName}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.name}
          </Text>
          <View style={styles.cartItemPriceContainer}>
            <Text style={styles.cartItemPrice}>
              {(item.price * item.quantity).toLocaleString()}원
            </Text>
            <Text style={styles.cartItemUnitPrice}>
              ({item.price.toLocaleString()}원/개)
            </Text>
          </View>
        </TouchableOpacity>
        <View style={styles.quantityContainer}>
          <TouchableOpacity
            style={[styles.quantityButton, styles.minusButton]}
            onPress={() => handleQuantityUpdate(item.id, item.quantity - 1)}
          >
            <Ionicons name="remove" size={18} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.quantityText}>{item.quantity}</Text>
          <TouchableOpacity
            style={[
              styles.quantityButton,
              styles.plusButton,
              maxReached && styles.quantityButtonDisabled,
            ]}
            onPress={() => handleQuantityUpdate(item.id, item.quantity + 1)}
            disabled={maxReached}
          >
            <Ionicons name="add" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.logoContainer}
          onPress={handleSecretTap}
          activeOpacity={1}
        >
          <Image
            source={require("../assets/images/logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <View style={styles.logoTextContainer}>
            <Text style={styles.headerTitle}>
              <Text style={styles.flickText}>Flick</Text> Place
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.productContainer}>
          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary500} />
              <Text style={styles.loadingText}>상품을 불러오는 중...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons
                name="alert-circle-outline"
                size={48}
                color={COLORS.danger500}
              />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => fetchProducts()}
              >
                <Text style={styles.retryButtonText}>다시 시도</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={products}
              renderItem={renderProductItem}
              keyExtractor={(item) => item.id.toString()}
              numColumns={3}
              contentContainerStyle={styles.productList}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  colors={[COLORS.primary500]}
                  tintColor={COLORS.primary500}
                />
              }
            />
          )}
        </View>

        <View style={styles.cartContainer}>
          <View style={styles.cartHeader}>
            <Text style={styles.cartTitle}>장바구니</Text>
            <View style={styles.clearButtonContainer}>
              {cart.length > 0 && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => clearCart()}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={COLORS.white}
                  />
                  <Text style={styles.clearButtonText}>비우기</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.cartContentContainer}>
            {cart.length === 0 ? (
              <View style={styles.emptyCartContainer}>
                <Ionicons
                  name="cart-outline"
                  size={60}
                  color={COLORS.gray300}
                />
                <Text style={styles.emptyCartText}>
                  장바구니가 비어있습니다
                </Text>
                <Text style={styles.emptyCartSubtext}>상품을 선택해주세요</Text>
              </View>
            ) : (
              <FlatList
                data={cart as CartItemType[]}
                renderItem={renderCartItem}
                keyExtractor={(item) => item.id.toString()}
                style={styles.cartItemList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>

          <View style={styles.cartSummary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>총 수량</Text>
              <Text style={styles.summaryValue}>{getTotalItems()}개</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>총 금액</Text>
              <Text style={styles.totalAmount}>
                {getTotalAmount().toLocaleString()}원
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.paymentButton,
                cart.length === 0 && styles.paymentButtonDisabled,
              ]}
              onPress={handlePayment}
              activeOpacity={0.8}
              disabled={cart.length === 0}
            >
              <Ionicons
                name="card-outline"
                size={20}
                color={COLORS.white}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.paymentButtonText}>결제하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoImage: {
    width: 36,
    height: 36,
    marginRight: 10,
  },
  logoTextContainer: {
    flexDirection: "column",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  flickText: {
    color: COLORS.primary500,
    fontWeight: "700",
  },
  contentContainer: {
    flex: 1,
    flexDirection: "row",
  },
  productContainer: {
    flex: 7,
    backgroundColor: COLORS.background,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.danger500,
    marginBottom: 24,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: COLORS.primary500,
    borderRadius: 12,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  productList: {
    paddingBottom: 24,
  },
  productItem: {
    flex: 1,
    margin: 8,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    height: 220,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  soldOutItem: {
    opacity: 0.7,
  },
  inCartItem: {
    borderColor: COLORS.primary300,
    borderWidth: 2,
  },
  productImageContainer: {
    width: "100%",
    height: 140,
    overflow: "hidden",
    backgroundColor: COLORS.borderLight,
    position: "relative",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  soldOutOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  soldOutText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 20,
    overflow: "hidden",
  },
  cartBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: COLORS.primary500,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cartBadgeText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "700",
  },
  productInfo: {
    padding: 12,
    flex: 1,
    justifyContent: "space-between",
  },
  productName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 2,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.primary500,
  },
  soldOutPrice: {
    color: COLORS.textSecondary,
  },
  stockContainer: {
    marginTop: 4,
  },
  stockText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  cartContainer: {
    flex: 3,
    backgroundColor: COLORS.white,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
    display: "flex",
    flexDirection: "column",
  },
  cartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    height: 64,
  },
  cartTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  clearButtonContainer: {
    width: 78,
    height: 32,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.danger500,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    height: 32,
  },
  clearButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "500",
    marginLeft: 4,
  },
  cartContentContainer: {
    flex: 1,
    position: "relative",
  },
  emptyCartContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyCartText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textTertiary,
  },
  emptyCartSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.gray500,
  },
  cartItemList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  cartItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  cartItemInfo: {
    flex: 1,
    marginRight: 8,
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  cartItemPriceContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  cartItemPrice: {
    fontSize: 15,
    color: COLORS.primary500,
    fontWeight: "600",
    marginRight: 4,
  },
  cartItemUnitPrice: {
    fontSize: 11,
    color: COLORS.textTertiary,
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  minusButton: {
    backgroundColor: COLORS.primary400,
  },
  plusButton: {
    backgroundColor: COLORS.primary500,
  },
  quantityButtonDisabled: {
    backgroundColor: COLORS.gray300,
  },
  quantityText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginHorizontal: 10,
    minWidth: 24,
    textAlign: "center",
  },
  cartSummary: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primary500,
  },
  paymentButton: {
    flexDirection: "row",
    backgroundColor: COLORS.primary500,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  paymentButtonDisabled: {
    backgroundColor: COLORS.primary100,
    opacity: 0.8,
  },
  paymentButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
});

export default Products;
