package org.soaringmeteo

import io.circe.Json
import org.slf4j.LoggerFactory

/**
 * Produce soaring forecast data from the GFS forecast data.
 *
 * GFS runs produce one file per time of forecast, and each file contains the forecast
 * data of all the locations in the world.
 *
 * We want to structure data differently: we want to gather, for one location, the
 * forecast data of several times.
 */
object MakeGFSJson {

  private val logger = LoggerFactory.getLogger(getClass)

  /**
   * Alternate entry point that only converts the grib files into JSON files.
   * Requires the grib files to have been downloaded first, for instance by
   * running [[DownloadGribFiles.main]]
   */
  def main(args: Array[String]): Unit = {
    val gfsLocFile = os.Path(args(0))
    val gribsDir   = os.Path(args(1))
    val jsonDir    = os.Path(args(2))

    MakeGFSJson.makeJsons(gfsLocFile, gribsDir, jsonDir)
  }

  /**
   * Extract data from the GFS forecast in the form of JSON documents. We create one JSON
   * document per forecast time (e.g., `0.json`, `3.json`, `6.json`, etc.), and each document
   * contains the [[GfsForecast]] data for each location listed in the file `gfsLocFile`.
   *
   * FIXME Create one file per type of data we want to show (boundary layer height, ThQ, etc.)
   *       so that users download only the necessary amount of data.
   *
   * @param gfsLocFile CSV file containing the information of the GFS points shown by soaringmeteo
   * @param gribsDir   Directory containing the .grib2 files of the GFS forecast
   * @param targetDir  Directory where we write our resulting JSON documents
   */
  def makeJsons(
    gfsLocFile: os.Path,
    gribsDir: os.Path,
    targetDir: os.Path
  ): Unit = {
    logger.debug("Parsing GFS locations CSV file")
    val gfsLocations = GfsLocation.parse(os.read(gfsLocFile))

    os.remove.all(targetDir)
    os.makeDir.all(targetDir)
    os.copy.over(gribsDir / "forecast.json", targetDir / "forecast.json", replaceExisting = true)

    for (t <- Settings.forecastHours) {
      logger.debug(s"Extracting GFS forecast data at time $t")
      val forecast = GfsForecast.fromGribFile(gribsDir, t, gfsLocations)
      val fields =
        forecast.iterator.map { case (p, forecast) =>
          // Coordinates are multiplied by 100 so that they are always rendered as integer
          // values and never have a trailing `.0` which would make it complicated to read
          // from the client-side
          val locationKey = s"${(p.longitude * 100).intValue},${(p.latitude * 100).intValue}"
          locationKey -> GfsForecast.jsonEncoder(forecast)
        }.toSeq

      val targetFile = targetDir / s"$t.json"
      os.write.over(targetFile, Json.obj(fields: _*).noSpaces)
    }
  }

}
