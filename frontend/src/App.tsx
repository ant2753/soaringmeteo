import { createEffect, createSignal, JSX, Show } from 'solid-js';
import { insert, render, style } from 'solid-js/web';

import { initializeMap } from './Map';
import { PeriodSelectors } from './PeriodSelector';
import { ForecastLayer } from './ForecastLayer';
import { fetchDefaultForecast, ForecastMetadata, showDate } from './data/ForecastMetadata';
import { Forecast } from './data/Forecast';
import * as L from 'leaflet';
import markerImg from './images/marker-icon.png';
import { StateProvider, useState } from './State';
import { Burger } from './Burger';

export const start = (containerElement: HTMLElement): void => {

  // The map *must* be initialized before we call the other constructors
  // It *must* also be mounted before we initialize it
  style(containerElement, { display: 'flex', 'align-items': 'stretch', 'align-content': 'stretch' });
  const mapElement = <div style={ { flex: 1 } } />;
  insert(containerElement, mapElement);

  const [canvas, map] = initializeMap(mapElement);

  const App = (props: {
    forecastMetadatas: Array<ForecastMetadata>
    morningOffset: number
  }): JSX.Element => {

    const [state, { clearLocationForecasts }] = useState();

    createEffect(() => {
      map.attributionControl.setPrefix(`Initialization: ${showDate(state.forecastMetadata.init)}`);
    });

    const selectedLocationMarker: L.Marker = L.marker([0, 0], { icon: L.icon({ iconUrl: markerImg, iconSize: [25, 41] }) });
    createEffect(() => {
      const selectedLocation = state.locationForecasts;
      if (selectedLocation !== undefined) {
        selectedLocationMarker.setLatLng([selectedLocation.latitude, selectedLocation.longitude]);
        selectedLocationMarker.addTo(map);
      } else {
        selectedLocationMarker.remove();
      }
    });

    map.on('keydown', (e: any) => {
      const event = e.originalEvent as KeyboardEvent;
      if (event.key === 'Escape') {
        clearLocationForecasts();
      }
    });

    // Signal of “popup requests”: when the users click on the map, they request a popup
    // to be displayed with numerical information about the visible layer.
    const [popupRequest, setPopupRequest] = createSignal<undefined | L.LeafletMouseEvent>(undefined);
    map.on('click', (event: L.LeafletMouseEvent) => {
      setPopupRequest(event);
    });
    // Clear popup requests when the users close the popup
    const locationDetailsPopup =
      L.popup()
        .on("remove", () => { setPopupRequest(undefined) })

    /**
     * @param latitude  Latitude of the popup to open
     * @param longitude Longitude of the popup to open
     * @param content   Content of the popup (must be a root element)
     */
    const openLocationDetailsPopup = (latitude: number, longitude: number, content: JSX.Element): void => {
      locationDetailsPopup
        .setLatLng([latitude, longitude])
        .setContent(content)
        .openOn(map);
    };

    // PeriodSelector displays the buttons to move over time. When we click on those buttons, it
    // calls `onHourOffsetChanged`, which we handle by updating our `state`, which is propagated
    // back to these components.
    // ForecastLayer displays the configuration button and manages the canvas overlay.
    return <>
      <span style={{
        position: 'absolute', top: 0, left: 0, 'z-index': 1200
      }}>
        <Burger />
      </span>
      <PeriodSelectors morningOffset={props.morningOffset} />
      <ForecastLayer
        forecastMetadatas={props.forecastMetadatas}
        canvas={canvas}
        popupRequest={popupRequest}
        openLocationDetailsPopup={openLocationDetailsPopup}
      />
    </>
  }

  const Loader = ((): JSX.Element => {
    const [loaded, setLoaded] = createSignal<[Array<ForecastMetadata>, ForecastMetadata, number, number, Forecast]>(undefined)
    fetchDefaultForecast()
      .then(([forecastMetadatas, forecastMetadata, morningOffset, hourOffset, forecast]) => {
        setLoaded([forecastMetadatas, forecastMetadata, morningOffset, hourOffset, forecast]);
      })
      .catch(reason => {
        console.error(reason);
        alert('Unable to retrieve forecast data');
      })
    return <Show when={ loaded() }>
      { ([forecastMetadatas, forecastMetadata, morningOffset, hourOffset, forecast]) =>
        <StateProvider
          forecastMetadata={forecastMetadata}
          hourOffset={hourOffset}
          currentForecast={forecast}
        >
          <App
            forecastMetadatas={forecastMetadatas}
            morningOffset={morningOffset}
          />
        </StateProvider>
      }
    </Show>
  });

  render(() => <Loader />, mapElement);
};
