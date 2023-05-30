import { useAsyncEffect } from "@hilma/tools";
import { Platform, Subscription } from "expo-modules-core";
import { Pedometer } from "expo-sensors";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";

let subscription: Subscription | null = null;

async function setSteps(steps: number) {
  try {
    console.log("steps: ", steps);
    await AsyncStorage.setItem("@count-steps_steps", String(steps));
  } catch (error) {
    console.error(error);
  }
}

async function getSteps() {
  try {
    const value = await AsyncStorage.getItem("@count-steps_steps");
    console.log("value: ", value);
    if (!value || isNaN(Number(value))) return 0;
    return Number(value);
  } catch (error) {
    console.error(error);
    return 0;
  }
}

const BACKGROUND_STEP_COUNT = "background-step-count";

TaskManager.defineTask(BACKGROUND_STEP_COUNT, async () => {
  console.log("task called");

  subscription = Pedometer.watchStepCount(({ steps }) => {
    console.log("task event triggered: ", steps);
    setSteps(steps);
  });

  return BackgroundFetch.BackgroundFetchResult.NewData;
});

async function registerBackgroundStepCount() {
  console.log("registering background step count");
  return BackgroundFetch.registerTaskAsync(BACKGROUND_STEP_COUNT, {
    minimumInterval: 1,
    startOnBoot: true,
    stopOnTerminate: false,
  });
}

async function unregisterBackgroundStepCount() {
  console.log("unregistering background step count: ", subscription);
  if (subscription) subscription.remove();
  return BackgroundFetch.unregisterTaskAsync(BACKGROUND_STEP_COUNT);
}

export default function App() {
  const [stepCount, setStepCount] = useState(0);

  async function kickstart(): Promise<(() => void) | void> {
    const pedometerIsAvailable = await Pedometer.isAvailableAsync();
    const backgroundFetchIsAvailable = await BackgroundFetch.getStatusAsync();

    if (pedometerIsAvailable) {
      const { granted, canAskAgain } = await Pedometer.getPermissionsAsync();

      if (!granted) {
        if (canAskAgain) {
          const { granted } = await Pedometer.requestPermissionsAsync();

          if (!granted) return kickstart();
        } else {
          console.error("Could not get permission.");
          return;
        }
      }

      if (Platform.OS === "ios") {
        const start = new Date();
        const end = new Date();
        start.setDate(end.getDate() - 1);

        const { steps } = await Pedometer.getStepCountAsync(start, end);
        setStepCount(steps);
      } else {
        const stepsInStorage = await getSteps();

        setStepCount(stepsInStorage);

        const isRegistered = await TaskManager.isTaskRegisteredAsync(
          BACKGROUND_STEP_COUNT
        );

        if (
          isRegistered &&
          backgroundFetchIsAvailable ===
          BackgroundFetch.BackgroundFetchStatus.Available
        )
          await unregisterBackgroundStepCount();

        if (
          backgroundFetchIsAvailable ===
          BackgroundFetch.BackgroundFetchStatus.Available
        )
          await registerBackgroundStepCount();

        const subscription = Pedometer.watchStepCount(({ steps }) => {
          console.log("setting step state: ", steps);
          setStepCount(steps + stepsInStorage);
          setSteps(steps + stepsInStorage);
        });

        return () => subscription.remove();
      }
    }
  }

  useAsyncEffect(kickstart, []);

  return (
    <View style={styles.container}>
      <Text>You have taken {stepCount} steps</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
