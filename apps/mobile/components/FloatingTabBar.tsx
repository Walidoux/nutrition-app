import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BAR_HEIGHT = 68;
const INDICATOR_SIZE = 46;
const ICON_SIZE = 26;
const H_PADDING = 14;

export default function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const routes = state.routes;

  const activeIndex = useSharedValue(state.index);
  const barWidth = useSharedValue(0);
  const bounce = useSharedValue(0); // pop pulse

  useEffect(() => {
    activeIndex.value = withSpring(state.index, { mass: 0.6, damping: 16, stiffness: 220 });
    bounce.value = 0;
    bounce.value = withSequence(
      withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) })
    );
  }, [state.index]);

  const indicatorStyle = useAnimatedStyle(() => {
    const tabs = Math.max(routes.length, 1);
    const w = Math.max(barWidth.value, 1);
    const itemW = (w - H_PADDING * 2) / tabs;
    const x = H_PADDING + itemW * activeIndex.value + (itemW - INDICATOR_SIZE) / 2;
    return { transform: [{ translateX: x }] };
  });

  const tint = scheme === 'dark' ? 'dark' : 'light';
  const indicatorBg = scheme === 'dark' ? 'rgba(99, 102, 241, 0.28)' : 'rgba(99, 102, 241, 0.18)';

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]}>
      <BlurView
        intensity={80}
        tint={tint}
        style={[
          styles.surface,
          scheme === 'dark'
            ? { backgroundColor: 'rgba(22,22,26,0.55)' }
            : { backgroundColor: 'rgba(255,255,255,0.75)' },
        ]}
        onLayout={(e) => {
          barWidth.value = e.nativeEvent.layout.width;
        }}>
        <Animated.View
          style={[
            styles.indicator,
            { backgroundColor: indicatorBg, top: (BAR_HEIGHT - INDICATOR_SIZE) / 2 },
            indicatorStyle,
          ]}
        />
        <View style={styles.row}>
          {routes.map((route, index) => {
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!event.defaultPrevented) {
                if (!isFocused) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(console.error);
                  navigation.navigate(route.name);
                } else {
                  // Light tick if you tap the already-selected tab
                  Haptics.selectionAsync().catch(console.error);
                }
              }
            };

            const progress = useDerivedValue(() =>
              withSpring(isFocused ? 1 : 0, { mass: 0.6, damping: 16, stiffness: 260 })
            );

            // Pop via scale only (no vertical lift) to keep perfect centering
            const animatedIconStyle = useAnimatedStyle(() => {
              const pop = bounce.value * progress.value;
              const scale = 1 + 0.1 * progress.value + 0.06 * pop;
              return { transform: [{ scale }] };
            });

            const iconName = getIcon(route.name);
            const color = isFocused
              ? scheme === 'dark'
                ? '#FFFFFF'
                : '#111827'
              : scheme === 'dark'
                ? '#9CA3AF'
                : '#6B7280';

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                onPress={onPress}
                style={styles.item}
                android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
                hitSlop={8}>
                <Animated.View style={[styles.iconBox, animatedIconStyle]}>
                  <Ionicons
                    name={iconName}
                    size={ICON_SIZE}
                    color={color}
                    style={styles.iconGlyph as any} // ensure Text styles apply to the glyph
                  />
                </Animated.View>
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

function getIcon(routeName: string): React.ComponentProps<typeof Ionicons>['name'] {
  switch (routeName.toLowerCase()) {
    case 'scan':
      return 'scan-outline';
    case 'groceries':
      return 'cart-outline';
    case 'budgets':
      return 'wallet-outline';
    default:
      return 'grid-outline';
  }
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  surface: {
    height: BAR_HEIGHT,
    borderRadius: 28,
    paddingHorizontal: H_PADDING,
    overflow: 'hidden',
    justifyContent: 'center',
    // stronger shadow for a true "float"
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.22,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
      },
      android: {
        elevation: 24,
      },
      default: {},
    }),
  },
  row: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
  },
  item: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    position: 'absolute',
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
  },
  iconBox: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Helps center the glyph inside its box on Android
  iconGlyph: {
    includeFontPadding: false,
    textAlignVertical: 'center',
    textAlign: 'center',
  },
});
