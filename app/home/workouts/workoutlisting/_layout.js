import { AntDesign, Octicons } from "@expo/vector-icons";
import { FlatList, Image, Text, View } from "react-native";

import IconWithText from "../../../../components/ui/IconWithText";
import { colors } from "../../../../constants/colors";

const WorkoutListingScreen = ({ route }) => {
  let workouts = [
    {
      bodyPart: "Chest",
      level: "Intermediate",
      calories: 400,
      img: "https://link.com/chest.png",

      workouts: [
        {
          name: "Push Ups",
          photo: "...",
          time: "25 min",
          calories: "200",
          level: "Intermediate",
        },
      ],
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <Image
        source={{ uri: img }}
        style={{
          width: "100%",
          height: "20%",
          resizeMode: "cover",
        }}
      />

      {/* BodyPart info */}
      <View style={{ padding: 20 }}>
        <Text
          style={{
            fontSize: 22,
            fontWeight: "700",
          }}
        >
          {"bodyPart"}
        </Text>

        <Text style={{ fontSize: 14, color: "#555", marginTop: 5 }}>
          Level: {"level"}
        </Text>

        <Text style={{ fontSize: 14, color: colors.primary }}>
          {"calories"} Calories burn
        </Text>
      </View>

      {/* Workout List */}
      <FlatList
        data={workouts}
        keyExtractor={(item, index) => index.toString()}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        renderItem={({ item }) => (
          <View
            style={{
              flexDirection: "row",
              borderWidth: 0.3,
              borderColor: "#ddd",
              borderRadius: 10,
              padding: 15,
              marginBottom: 15,
              alignItems: "center",
            }}
          >
            <Image
              style={{
                borderRadius: 10,
                width: 60,
                height: 60,
              }}
              source={{ uri: item.photo }}
              resizeMode="cover"
            />

            <View style={{ marginLeft: 15, gap: 5 }}>
              <Text
                style={{ fontSize: 16, fontWeight: "600" }}
                numberOfLines={1}
              >
                {item.name}
              </Text>

              <Text style={{ fontSize: 12, color: "#666" }}>{item.level}</Text>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <IconWithText
                  icon={<Octicons name="clock" size={14} color="#666" />}
                  label={item.time}
                  size={12}
                  textStyle={{ fontSize: 11 }}
                  orientation="horizontal"
                />

                <IconWithText
                  icon={<AntDesign name="fire" size={12} color="#ff6600" />}
                  label={`${item.calories} Cal`}
                  size={12}
                  textStyle={{ fontSize: 11 }}
                  orientation="horizontal"
                />
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
};

export default WorkoutListingScreen;
