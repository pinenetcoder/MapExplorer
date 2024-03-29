import React, { useState, useEffect, useRef } from "react";
import { lineStyle } from "@/utils/geoJsonData";
import { STEPS_THRESHOLD, THRESHOLD } from "@/data/constantas";
import { Layer, Source, GeolocateControl } from "react-map-gl";
import { calculateDistance } from "@/utils/helpers";
import Instruction from "./Instruction";
import { directionApiUrlMaker } from "@/utils/helpers";

export const MapRouteBuilder = ({
  showRoutes,
  currentLocation,
  currentMarker,
  setBearing,
}) => {
  const [coords, setCoords] = useState([]);
  const [steps, setSteps] = useState([]);
  const [xyz, setXyz] = useState(0);
  const [maneuverStepLocation, setManeuverStepLocation] = useState();
  const [distanceToNewManeuver, setDistanceToNewManeuver] = useState(0);
  const startPoint = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [...coords],
        },
      },
    ],
  };

  const getRoute = async () => {
    const myLon = currentLocation.longitude;
    const myLat = currentLocation.latitude;

    const curMarkerLon = currentMarker.longitude;
    const curMakerLat = currentMarker.latitude;
    try {
      const response = await fetch(
        directionApiUrlMaker(
          myLon,
          myLat,
          curMarkerLon,
          curMakerLat,
          process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
          "ru"
        )
      );

      if (!response.ok) {
        throw new Error("Failed to fetch route data");
      }

      const data = await response.json();
      const route = data.routes[0];

      setCoords(route.geometry.coordinates);
      setSteps(route.legs[0].steps.map((step) => step.maneuver.instruction));
      setManeuverStepLocation(
        route.legs[0].steps.map((step) => step.maneuver.location)
      );
      setBearing(
        route.legs[0].steps.map((step) => step.maneuver.bearing_after)
      );
    } catch (error) {
      console.error("Error fetching route data:", error);
    }
  };

  const nextStepManager = () => {
    const isCoords =
      currentLocation.latitude !== 0 &&
      currentLocation.longitude !== 0 &&
      currentMarker.latitude &&
      currentMarker.longitude &&
      coords.length > 0;

    if (isCoords) {
      const locationToNextStepDistance = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        maneuverStepLocation[0][1],
        maneuverStepLocation[0][0]
      );
      setDistanceToNewManeuver(locationToNextStepDistance);

      if (locationToNextStepDistance <= THRESHOLD) {
        setSteps((prev) => {
          return [...prev].splice(1);
        });
        setManeuverStepLocation((prev) => {
          return [...prev].splice(1);
        });
        setBearing((prev) => {
          return [...prev].splice(1);
        });
      }
    }
  };

  const blueLineUpdateManager = () => {
    const isCoords =
      currentLocation.latitude !== 0 &&
      currentLocation.longitude !== 0 &&
      currentMarker.latitude &&
      currentMarker.longitude &&
      coords.length > 0;
    if (isCoords) {
      const locationToNextStepDistance = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        coords[1][1],
        coords[1][0]
      );
      setXyz(locationToNextStepDistance);

      if (locationToNextStepDistance <= STEPS_THRESHOLD) {
        setCoords((prev) => {
          return [...prev].splice(1);
        });
      }
    }
  };

  useEffect(() => {
    blueLineUpdateManager();
  }, [currentLocation, currentMarker, coords]);

  useEffect(() => {
    getRoute();
  }, [showRoutes]);

  useEffect(() => {
    nextStepManager();
  }, [
    distanceToNewManeuver,
    steps,
    maneuverStepLocation,
    currentLocation,
    currentMarker,
  ]);

  useEffect(() => {
    const onGeolocate = (e) => {
      const userLocation = [e.coords.longitude, e.coords.latitude];
      const { longitude, latitude } = e.coords;

      // Update start coordinates with user's current location
      setStart(userLocation);
    };

    GeolocateControl.current?.on("geolocate", onGeolocate);

    return () => {
      GeolocateControl.current?.off("geolocate", onGeolocate);
    };
  }, [currentLocation, currentMarker, distanceToNewManeuver, steps]);

  return (
    <>
      <div
        className="absolute z-50 text-lg"
        style={{
          color: "white",
          left: "5px",
          top: "180px",
          fontSize: "24px",
        }}
      >
        {steps.length > 0 && (
          <Instruction
            instruction={steps[0]}
            distanceToNewManeuver={distanceToNewManeuver}
          />
        )}
      </div>

      <Source id="routeSource" type="geojson" data={startPoint}>
        <Layer {...lineStyle} />
      </Source>
    </>
  );
};
