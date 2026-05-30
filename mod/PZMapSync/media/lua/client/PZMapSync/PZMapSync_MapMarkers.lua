require "PZMapSync/PZMapSync_Config"

PZMapSync = PZMapSync or {}

local MapMarkers = {
    lastProbeAt = 0,
    lastProbe = {
        available = false,
        reason = "not probed",
        symbols = {}
    }
}

local function callString(target, methodName)
    if not target or not target[methodName] then
        return nil
    end

    local ok, value = pcall(function()
        return target[methodName](target)
    end)

    if ok and value ~= nil then
        return tostring(value)
    end

    return nil
end

local function callNumber(target, methodName)
    if not target or not target[methodName] then
        return nil
    end

    local ok, value = pcall(function()
        return target[methodName](target)
    end)

    if ok and value ~= nil then
        return tonumber(value)
    end

    return nil
end

local function inspectSymbol(symbol, index)
    local isText = callString(symbol, "isText") == "true"
    local isTexture = callString(symbol, "isTexture") == "true"
    local kind = callString(symbol, "getType") or callString(symbol, "type") or "unknown"

    if isText then
        kind = "text"
    elseif isTexture then
        kind = "texture"
    end

    return {
        index = index,
        type = kind,
        symbolId = callString(symbol, "getSymbolID"),
        text = callString(symbol, "getUntranslatedText") or callString(symbol, "getTranslatedText"),
        x = callNumber(symbol, "getWorldX") or callNumber(symbol, "getX"),
        y = callNumber(symbol, "getWorldY") or callNumber(symbol, "getY"),
        z = callNumber(symbol, "getZ"),
        r = callNumber(symbol, "getRed"),
        g = callNumber(symbol, "getGreen"),
        b = callNumber(symbol, "getBlue"),
        a = callNumber(symbol, "getAlpha"),
        scale = callNumber(symbol, "getScale"),
        rotation = callNumber(symbol, "getRotation")
    }
end

local function getSymbolsAPIFromVisibleMap()
    if ISWorldMap_instance and ISWorldMap_instance.mapAPI and ISWorldMap_instance.mapAPI.getSymbolsAPIv2 then
        local ok, symbolsAPI = pcall(function()
            return ISWorldMap_instance.mapAPI:getSymbolsAPIv2()
        end)

        if ok and symbolsAPI then
            return symbolsAPI, "ISWorldMap_instance"
        end
    end

    if getPlayerMiniMap then
        local okMiniMap, miniMap = pcall(function()
            return getPlayerMiniMap(0)
        end)

        if okMiniMap and miniMap and miniMap.mapAPI and miniMap.mapAPI.getSymbolsAPIv2 then
            local ok, symbolsAPI = pcall(function()
                return miniMap.mapAPI:getSymbolsAPIv2()
            end)

            if ok and symbolsAPI then
                return symbolsAPI, "player minimap"
            end
        end
    end

    return nil, nil
end

local function getSymbolsAPIFromProbeMap()
    if not UIWorldMap or not MapItem or not MapItem.getSingleton then
        return nil, "UIWorldMap or MapItem.getSingleton is unavailable"
    end

    local okMapItem, mapItem = pcall(function()
        return MapItem.getSingleton()
    end)

    if not okMapItem or not mapItem then
        return nil, "MapItem.getSingleton failed"
    end

    local okWorldMap, worldMap = pcall(function()
        return UIWorldMap.new({})
    end)

    if not okWorldMap or not worldMap or not worldMap.getAPIv3 then
        return nil, "UIWorldMap probe creation failed"
    end

    local okAPI, mapAPI = pcall(function()
        return worldMap:getAPIv3()
    end)

    if not okAPI or not mapAPI or not mapAPI.setMapItem or not mapAPI.getSymbolsAPIv2 then
        return nil, "World map API v3 or symbols API v2 is unavailable"
    end

    local okSetMapItem = pcall(function()
        mapAPI:setMapItem(mapItem)
    end)

    if not okSetMapItem then
        return nil, "mapAPI:setMapItem failed"
    end

    local okSymbols, symbolsAPI = pcall(function()
        return mapAPI:getSymbolsAPIv2()
    end)

    if not okSymbols or not symbolsAPI then
        return nil, "mapAPI:getSymbolsAPIv2 failed"
    end

    return symbolsAPI, "UIWorldMap probe"
end

local function getSymbolsAPI()
    local symbolsAPI, source = getSymbolsAPIFromVisibleMap()

    if symbolsAPI then
        return symbolsAPI, source
    end

    return getSymbolsAPIFromProbeMap()
end

function MapMarkers.probe(nowMs)
    if not PZMapSync.Config.IncludeMarkerProbe then
        return MapMarkers.lastProbe
    end

    if nowMs - MapMarkers.lastProbeAt < PZMapSync.Config.MarkerProbeIntervalMs then
        return MapMarkers.lastProbe
    end

    MapMarkers.lastProbeAt = nowMs

    local symbolsAPI, sourceOrReason = getSymbolsAPI()

    if not symbolsAPI then
        MapMarkers.lastProbe = {
            available = false,
            reason = sourceOrReason or "symbols API is unavailable",
            symbols = {}
        }
        return MapMarkers.lastProbe
    end

    local count = callNumber(symbolsAPI, "getSymbolCount") or 0
    local modificationCount = callNumber(symbolsAPI, "getModificationCount")
    local inspected = {}
    local inspectCount = count

    for index = 0, inspectCount - 1 do
        local okSymbol, symbol = pcall(function()
            return symbolsAPI:getSymbolByIndex(index)
        end)

        if okSymbol and symbol then
            inspected[#inspected + 1] = inspectSymbol(symbol, index)
        end
    end

    MapMarkers.lastProbe = {
        available = true,
        reason = nil,
        source = sourceOrReason,
        symbolCount = count,
        modificationCount = modificationCount,
        symbols = inspected
    }

    return MapMarkers.lastProbe
end

function MapMarkers.getMarkers(nowMs)
    local probe = MapMarkers.probe(nowMs)

    if probe and probe.available and probe.symbols then
        return probe.symbols
    end

    return {}
end

PZMapSync.MapMarkers = MapMarkers
